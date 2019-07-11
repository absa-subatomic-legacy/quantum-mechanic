import {OpenshiftListResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {
    ChannelMessageClient,
    ResponderMessageClient,
    SimpleQMMessageClient,
} from "../../../context/QMMessageClient";
import {ProdRequestMessages} from "../../messages/prod/ProdRequestMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {PackageOpenshiftResourceService} from "../../services/packages/PackageOpenshiftResourceService";
import {
    getHighestPreProdEnvironment,
    getResourceDisplayMessage,
} from "../../util/openshift/Helpers";
import {assertApplicationProdCanBeRequested} from "../../util/prod/ProdAssertions";
import {
    getProjectOpenshiftNamespace,
    } from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {
    DeploymentPipelineIdParam,
    DeploymentPipelineIdSetter,
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";
import {handleQMError} from "../../util/shared/Error";
import {
    QMDeploymentPipeline,
    QMProject,
} from "../../util/transform/types/gluon/Project";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Create application in prod", atomistIntent(CommandIntent.CreateApplicationProd))
@Tags("subatomic", "package")
export class CreateApplicationProd extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter, DeploymentPipelineIdSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @DeploymentPipelineIdParam({
        callOrder: 2,
        selectionMessage: "Please select the deployment pipeline to deploy the package into",
    })
    public deploymentPipelineId: string;

    @GluonApplicationNameParam({
        callOrder: 3,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 4,
    })
    public openShiftCloud: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public approval: ApprovalEnum = ApprovalEnum.TO_CONFIRM;

    @Parameter({
        required: false,
        displayable: false,
    })
    public correlationId: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public openShiftResourcesJSON: string;

    private prodRequestMessages = new ProdRequestMessages();

    constructor(public gluonService = new GluonService(), public ocService = new OCService(), public packageOpenshiftResourceService = new PackageOpenshiftResourceService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const team = await this.gluonService.teams.getTeamByName(this.teamName);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            if (this.approval === ApprovalEnum.TO_CONFIRM) {
                // Ensure the owning project is prod approved before proceeding
                await assertApplicationProdCanBeRequested(this.projectName, this.deploymentPipelineId, this.gluonService);

                this.correlationId = uuid();
                const result = await this.getRequestConfirmation(qmMessageClient);
                this.succeedCommand();
                return result;
            } else if (this.approval === ApprovalEnum.APPROVED) {

                await this.createApplicationProdRequest();

                const result = await qmMessageClient.send(this.getConfirmationResultMesssage(this.approval), {id: this.correlationId});
                this.succeedCommand();
                return result;
            } else if (this.approval === ApprovalEnum.REJECTED) {
                const result = await qmMessageClient.send(this.getConfirmationResultMesssage(this.approval), {id: this.correlationId});
                this.succeedCommand();
                return result;
            }
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private getConfirmationResultMesssage(result: ApprovalEnum) {
        const message = {
            text: `*Prod request status:*`,
            attachments: [],
        };

        if (result === ApprovalEnum.APPROVED) {
            message.attachments.push({
                text: `*Confirmed*`,
                fallback: "*Confirmed*",
                color: QMColours.stdGreenyMcAppleStroodle.hex,
            });
        } else if (result === ApprovalEnum.REJECTED) {
            message.attachments.push({
                text: `*Cancelled*`,
                fallback: "*Cancelled*",
                color: QMColours.stdReddyMcRedFace.hex,
            });
        }

        return message;
    }

    private async getRequestConfirmation(qmMessageClient: SimpleQMMessageClient) {
        await qmMessageClient.send({
            text: "🚀 Finding available resources...",
        });

        await this.findAndListResources(qmMessageClient);

        const message = this.prodRequestMessages.confirmApplicationProdRequest(this);

        return await qmMessageClient.send(message, {id: this.correlationId});
    }

    private async findAndListResources(qmMessageClient: SimpleQMMessageClient) {

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        await this.gluonService.prod.project.assertProjectProdIsApproved(project.projectId, this.deploymentPipelineId);

        const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);

        const deploymentPipeline: QMDeploymentPipeline = project.releaseDeploymentPipelines.filter(pipeline => pipeline.pipelineId === this.deploymentPipelineId)[0];

        const allResources: OpenshiftListResource = await this.ocService.exportAllResources(getProjectOpenshiftNamespace(tenant.name, project.name, deploymentPipeline.tag, getHighestPreProdEnvironment(deploymentPipeline).postfix));

        const resources = await this.packageOpenshiftResourceService.getAllApplicationRelatedResources(
            this.applicationName,
            allResources,
        );

        logger.info("Stringifying identified prod resources");

        this.openShiftResourcesJSON = JSON.stringify(resources.items.map(resource => {
                return {
                    kind: resource.kind,
                    name: resource.metadata.name,
                    resourceDetails: JSON.stringify(resource),
                };
            },
        ));

        logger.info("Informing user of identified resources");

        return await qmMessageClient.send({
            text: getResourceDisplayMessage(resources),
        });

    }

    private async createApplicationProdRequest() {
        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const application = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, project.name);

        const actionedBy = await this.gluonService.members.gluonMemberFromScreenName(this.screenName, false);

        const openShiftResources = JSON.parse(this.openShiftResourcesJSON);

        const request = {
            applicationId: application.applicationId,
            actionedBy: actionedBy.memberId,
            deploymentPipeline: {
                pipelineId: this.deploymentPipelineId,
            },
            openShiftResources,
        };

        await this.gluonService.prod.application.createApplicationProdRequest(request);
    }
}
