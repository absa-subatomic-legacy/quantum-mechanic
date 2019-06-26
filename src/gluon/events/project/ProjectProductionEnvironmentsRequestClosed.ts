import {
    addressSlackChannelsFromContext,
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {AtomistQMContext} from "../../../context/QMContext";
import {ChannelMessageClient} from "../../../context/QMMessageClient";
import {ReRunProjectProdRequest} from "../../commands/project/ReRunProjectProdRequest";
import {ProdRequestMessages} from "../../messages/prod/ProdRequestMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {QMProjectProdRequest} from "../../services/gluon/ProjectProdRequestService";
import {CreateOpenshiftEnvironments} from "../../tasks/project/CreateOpenshiftEnvironments";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {AddJenkinsToProdEnvironment} from "../../tasks/team/AddJenkinsToProdEnvironment";
import {CreateTeamDevOpsEnvironment} from "../../tasks/team/CreateTeamDevOpsEnvironment";
import {
    getPipelineOpenShiftNamespacesForOpenShiftCluster,
    OpenshiftProjectEnvironmentRequest,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {handleQMError} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetailsProd} from "../../util/team/Teams";

@EventHandler("Receive ProjectProductionEnvironmentsRequestClosedEvent events", `
subscription ProjectProductionEnvironmentsRequestClosedEvent {
  ProjectProductionEnvironmentsRequestClosedEvent {
    id
    projectProdRequestId
  }
}
`)
export class ProjectProductionEnvironmentsRequestClosed extends BaseQMEvent implements HandleEvent<any> {

    private prodMessages: ProdRequestMessages = new ProdRequestMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectProductionEnvironmentsRequestClosedEvent event: ${JSON.stringify(event.data)}`);

        const projectProductionRequestClosedEvent = event.data.ProjectProductionEnvironmentsRequestClosedEvent[0];

        logger.info("Trying to find projectProdRequestDetails");

        const projectProdRequest: QMProjectProdRequest = await this.gluonService.prod.project.getProjectProdRequestById(projectProductionRequestClosedEvent.projectProdRequestId);

        const associatedTeams = await this.gluonService.teams.getTeamsAssociatedToProject(projectProdRequest.project.projectId);

        const qmMessageClient = this.createMessageClient(ctx, associatedTeams);

        try {
            if (projectProdRequest.approvalStatus === ApprovalEnum.APPROVED.valueOf()) {
                await qmMessageClient.send(`Prod request for project ${projectProdRequest.project.name} was approved.`);

                const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(projectProdRequest.project.name);

                const owningTeam = await this.gluonService.teams.getTeamById(project.owningTeam.teamId);

                const owningTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

                const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Provisioning of environment's for project *${project.name}* started:`,
                    qmMessageClient);

                const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

                const request: OpenshiftProjectEnvironmentRequest = await this.createEnvironmentRequest(project, associatedTeams, owningTenant);

                for (const prodOpenshift of QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftProd) {

                    // Get the devops prod environment details.
                    const devopsEnvironmentDetails = getDevOpsEnvironmentDetailsProd(owningTeam.name);

                    // Get details of all the prod project namespaces we need to operate on.
                    const environmentsForCreation: OpenShiftProjectNamespace[] = getPipelineOpenShiftNamespacesForOpenShiftCluster(owningTenant.name, project, projectProdRequest.deploymentPipeline, prodOpenshift);

                    taskRunner.addTask(new CreateTeamDevOpsEnvironment(owningTeam, prodOpenshift, devopsEnvironmentDetails),
                    ).addTask(
                        new CreateOpenshiftEnvironments(new AtomistQMContext(ctx), request, environmentsForCreation, prodOpenshift, owningTeam, devopsEnvironmentDetails ),
                    ).addTask(
                        new AddJenkinsToProdEnvironment({
                            team: owningTeam,
                            project,
                        }, environmentsForCreation, prodOpenshift),
                    );
                }

                await taskRunner.execute(ctx);
                this.succeedEvent();
                await qmMessageClient.send(this.prodMessages.getProjectProdCompleteMessage(project.name, projectProdRequest.deploymentPipeline.pipelineId));
            } else {
                logger.info(`Closed prod request: ${JSON.stringify(projectProdRequest, null, 2)}`);
                await qmMessageClient.send(`Prod request for project ${projectProdRequest.project.name} was rejected and closed by @${projectProdRequest.rejectingMember.slack.screenName}`);
            }
            return await success();
        } catch (error) {
            await handleQMError(qmMessageClient, error);
            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(projectProdRequest.project.name);
            const correlationId: string = uuid();
            const destination = await addressSlackChannelsFromContext(ctx, project.owningTeam.slack.teamChannel);
            this.failEvent();
            return await ctx.messageClient.send(this.createRetryButton(projectProdRequest.projectProdRequestId, correlationId), destination, {id: correlationId});
        }
    }

    private async createEnvironmentRequest(project, associatedTeams, owningTenant): Promise<OpenshiftProjectEnvironmentRequest> {
        return {
            teams: associatedTeams,
            project,
            owningTenant,
        };
    }

    private createMessageClient(ctx: HandlerContext,
                                teams: Array<{ slack: { teamChannel: string } }>) {
        const messageClient = new ChannelMessageClient(ctx);
        teams.map(team => {
            messageClient.addDestination(team.slack.teamChannel);
        });
        return messageClient;
    }

    private createRetryButton(projectProdRequestId: string, correlationId: string) {
        return {
            text: "The prod request failed to run.",
            attachments: [{
                text: "Please check with your system admin and retry when the reason of failure has been determined.",
                fallback: "Please check with your system admin and retry when the reason of failure has been determined.",
                color: QMColours.stdReddyMcRedFace.hex,
                actions: [
                    buttonForCommand(
                        {
                            text: "Retry Request",
                            style: "danger",
                        },
                        new ReRunProjectProdRequest(),
                        {
                            correlationId,
                            projectProdRequestId,
                        },
                    ),
                ],
            },
            ],
        };
    }
}
