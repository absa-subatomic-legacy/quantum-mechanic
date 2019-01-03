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
import {GenericProdRequestMessages} from "../../messages/project/GenericProdRequestMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {GenericOpenshiftResourceService} from "../../services/projects/GenericOpenshiftResourceService";
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

@CommandHandler("Move openshift resources to prod", QMConfig.subatomic.commandPrefix + " request generic prod")
@Tags("subatomic", "project", "other")
export class CreateGenericProd extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, DeploymentPipelineIdSetter {

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
        selectionMessage: "Please select the deployment pipeline you wish to deploy the generic resources into prod for",
    })
    public deploymentPipelineId: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 3,
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

    private genericProdRequestMessages = new GenericProdRequestMessages();

    constructor(public gluonService = new GluonService(), public ocService = new OCService(), public genericOpenshiftResourceService = new GenericOpenshiftResourceService()) {
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

                await this.createGenericProdRequest();

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

        const message = this.genericProdRequestMessages.confirmProdRequest(this);

        return await qmMessageClient.send(message, {id: this.correlationId});
    }

    private async findAndListResources(qmMessageClient: QMMessageClient) {

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);

        const deploymentPipeline: QMDeploymentPipeline = project.releaseDeploymentPipelines.filter(pipeline => pipeline.pipelineId === this.deploymentPipelineId)[0];

        const projectNamespace = getProjectOpenshiftNamespace(tenant.name, project.name, deploymentPipeline.tag, getHighestPreProdEnvironment(deploymentPipeline).postfix);
        const allResources = await this.ocService.exportAllResources(projectNamespace);

        /*const resources = this.genericOpenshiftResourceService.cleanAllPromotableResources(
            allResources.items,
        );*/

        logger.info(allResources);

        this.openShiftResourcesJSON = JSON.stringify(allResources.items.map(resource => {
                return {
                    kind: resource.kind,
                    name: resource.metadata.name,
                    resourceDetails: JSON.stringify(resource),
                };
            },
        ));

        return await qmMessageClient.send({
            text: getResourceDisplayMessage(allResources),
        });
    }

    private async createGenericProdRequest() {
        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        await this.gluonService.prod.project.assertProjectProdIsApproved(project.projectId, this.deploymentPipelineId);

        const actionedBy = await this.gluonService.members.gluonMemberFromScreenName(this.screenName, false);

        const openShiftResources = JSON.parse(this.openShiftResourcesJSON);

        const request = {
            project: {
                projectId: project.projectId,
            },
            deploymentPipeline: {
                pipelineId: this.deploymentPipelineId,
            },
            actionedBy: {
                memberId: actionedBy.memberId,
            },
            openShiftResources,
        };

        logger.info(`Prod request: ${JSON.stringify(request, null, 2)}`);

        await this.gluonService.prod.generic.createGenericProdRequest(request);
    }
}
