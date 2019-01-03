import {
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {OpenshiftListResource} from "../../../openshift/api/resources/OpenshiftResource";
import {ApplicationProdRequestMessages} from "../../messages/package/ApplicationProdRequestMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {PackageOpenshiftResourceService} from "../../services/packages/PackageOpenshiftResourceService";
import {
    getHighestPreProdEnvironment,
    getResourceDisplayMessage,
} from "../../util/openshift/Helpers";
import {
    getProjectOpenshiftNamespace,
    QMDeploymentPipeline,
    QMProject,
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
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Create application in prod", QMConfig.subatomic.commandPrefix + " request application prod")
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
    public approval: ApprovalEnum = ApprovalEnum.CONFIRM;

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

    private applicationProdRequestMessages = new ApplicationProdRequestMessages();

    constructor(public gluonService = new GluonService(), public ocService = new OCService(), public packageOpenshiftResourceService = new PackageOpenshiftResourceService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const team = await this.gluonService.teams.gluonTeamByName(this.teamName);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            if (this.approval === ApprovalEnum.CONFIRM) {
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

    private async getRequestConfirmation(qmMessageClient: QMMessageClient) {
        await qmMessageClient.send({
            text: "🚀 Finding available resources...",
        });

        await this.findAndListResources(qmMessageClient);

        const message = this.applicationProdRequestMessages.confirmProdRequest(this);

        return await qmMessageClient.send(message, {id: this.correlationId});
    }

    private async findAndListResources(qmMessageClient: QMMessageClient) {

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

        this.openShiftResourcesJSON = JSON.stringify(resources.items.map(resource => {
                return {
                    kind: resource.kind,
                    name: resource.metadata.name,
                    resourceDetails: JSON.stringify(resource),
                };
            },
        ));

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
