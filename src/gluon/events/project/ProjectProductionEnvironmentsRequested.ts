import {
    addressSlackUsersFromContext,
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {SlackMessage} from "@atomist/slack-messages";
import _ = require("lodash");
import {v4 as uuid} from "uuid";
import {UpdateProjectProdRequest} from "../../commands/project/UpdateProjectProdRequest";
import {GluonService} from "../../services/gluon/GluonService";
import {QMProjectProdRequest} from "../../services/gluon/ProjectProdRequestService";
import {
    getProjectDeploymentPipelineFromPipelineId,
    ProjectProdRequestApprovalResponse,
    QMDeploymentPipeline,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";

@EventHandler("Receive ProjectProductionEnvironmentsRequestedEvent events", `
subscription ProjectProductionEnvironmentsRequestedEvent {
  ProjectProductionEnvironmentsRequestedEvent {
    id
    projectProdRequestId
  }
}
`)
export class ProjectProductionEnvironmentsRequested extends BaseQMEvent implements HandleEvent<any> {

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectProductionEnvironmentsRequestedEvent event: ${JSON.stringify(event.data)}`);

        const environmentsRequestedEvent = event.data.ProjectProductionEnvironmentsRequestedEvent[0];

        logger.info("Trying to find projectProdRequestDetails");

        const projectProdRequest: QMProjectProdRequest = await this.gluonService.prod.project.getProjectProdRequestById(environmentsRequestedEvent.projectProdRequestId);

        const associatedTeams = await this.gluonService.teams.getTeamsAssociatedToProject(projectProdRequest.project.projectId);

        logger.info("Associated Teams: " + JSON.stringify(associatedTeams));

        const qmMessageClient = this.createMessageClient(ctx, associatedTeams);

        try {
            const projectName = projectProdRequest.project.name;

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(projectName);

            const deploymentPipeline: QMDeploymentPipeline = getProjectDeploymentPipelineFromPipelineId(project, projectProdRequest.deploymentPipeline.pipelineId);

            const membersToMessage = await this.gluonService.members.findMembersAssociatedToTeam(project.owningTeam.teamId);

            for (const teamMember of membersToMessage) {
                const requestCorrelationId: string = uuid();
                const destination = await addressSlackUsersFromContext(ctx, teamMember.slack.screenName);
                await ctx.messageClient.send({
                    text: `The project *${projectName}* owned by team *${project.owningTeam.name}* has been requested to move the *${deploymentPipeline.name}* pipeline into prod. As a member of the team you have please select an option below indicating whether you approve of this request.`,
                }, destination);

                await ctx.messageClient.send(
                    this.createPersonalisedMessage(teamMember, projectProdRequest.projectProdRequestId, requestCorrelationId),
                    destination,
                    {id: requestCorrelationId},
                );
            }

            await qmMessageClient.send("Successfully created project production request. Approval requests have been sent out.");
            this.succeedEvent();
            return await success();
        } catch (error) {
            this.failEvent();
            return await handleQMError(qmMessageClient, error);
        }
    }

    private createPersonalisedMessage(teamMember: { memberId: string, name: string, slack: { screenName } },
                                      projectProdRequestId: string,
                                      requestCorrelationId: string): SlackMessage {

        const baseParams: { [k: string]: string } = {
            projectProdRequestId,
            requestCorrelationId,
            actioningMemberId: teamMember.memberId,
        };

        const approvedParams = _.clone(baseParams);
        approvedParams.approvalStatus = ProjectProdRequestApprovalResponse.approve;

        const rejectedParams = _.clone(baseParams);
        rejectedParams.approvalStatus = ProjectProdRequestApprovalResponse.reject;

        const ignoredParams = _.clone(baseParams);
        ignoredParams.approvalStatus = ProjectProdRequestApprovalResponse.ignore;

        return {
            attachments: [
                {
                    text: "By choosing *Approve* you give your sign off that this project can go to prod.",
                    fallback: "Approve",
                    actions: [
                        buttonForCommand({
                                text: "Approve",
                                style: "primary",
                            }, new UpdateProjectProdRequest(),
                            approvedParams),
                    ],
                },
                {
                    text: "By choosing *Reject* you will your cancel this Prod request. A single rejection will cancel this prod request.",
                    fallback: "Reject",
                    actions: [
                        buttonForCommand({
                                text: "Reject",
                                style: "danger",
                            }, new UpdateProjectProdRequest(),
                            rejectedParams),
                    ],
                },
                {
                    text: "By choosing *Ignore* you are giving up your approval rights.",
                    fallback: "Ignore",
                    actions: [
                        buttonForCommand({
                                text: "Ignore",
                            }, new UpdateProjectProdRequest(),
                            ignoredParams),
                    ],
                },
            ],
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
}
