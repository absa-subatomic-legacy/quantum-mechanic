import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {TeamMembershipMessages} from "../../messages/member/TeamMembershipMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {QMTeamService} from "../../services/team/QMTeamService";
import {CreateOpenshiftProductionEnvironment} from "../../tasks/project/CreateOpenshiftProductionEnvironment";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {OpenshiftProjectEnvironmentRequest} from "../../util/project/Project";
import {
    ChannelMessageClient,
    handleQMError,
    QMError,
} from "../../util/shared/Error";

@EventHandler("Receive ProjectProductionEnvironmentsRequestedEvent events", `
subscription ProjectProductionEnvironmentsRequestedEvent {
  ProjectProductionEnvironmentsRequestedEvent {
    id
    project {
      projectId
      name
      description
    }
    teams {
      teamId
      name
      slackIdentity {
        teamChannel
      }
      owners {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
      members {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
    }
    owningTenant {
      tenantId,
      name,
      description
    }
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class ProjectProductionEnvironmentsRequested implements HandleEvent<any> {

    private teamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService(), public qmTeamService = new QMTeamService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectProductionEnvironmentsRequestedEvent event: ${JSON.stringify(event.data)}`);

        const environmentsRequestedEvent = event.data.ProjectProductionEnvironmentsRequestedEvent[0];

        logger.info("Creating project OpenShift production environments...");

        const projectName = environmentsRequestedEvent.project.name;

        const qmMessageClient = this.createMessageClient(ctx, environmentsRequestedEvent.teams);

        try {
            const project = await this.gluonService.projects.gluonProjectFromProjectName(projectName);
            await this.verifyUser(project, environmentsRequestedEvent.requestedBy.slackIdentity.screenName);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Provisioning of environment's for project *${projectName}* started:`,
                qmMessageClient);

            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            const request: OpenshiftProjectEnvironmentRequest = await this.createEnvironmentRequest(environmentsRequestedEvent);

            for (const prodOpenshift of QMConfig.subatomic.openshiftProd) {
                taskRunner.addTask(
                    new CreateOpenshiftProductionEnvironment(prodOpenshift, request),
                );
            }

            await taskRunner.execute(ctx);

            return await success();
        } catch (error) {
            return await handleQMError(qmMessageClient, error);
        }
    }

    private async createEnvironmentRequest(environmentRequestEvent): Promise<OpenshiftProjectEnvironmentRequest> {
        return {
            teams: environmentRequestEvent.teams,
            project: environmentRequestEvent.project,
            owningTenant: environmentRequestEvent.owningTenant,
        };
    }

    private verifyUser(gluonProject, screenName) {
        if (!this.qmTeamService.isUserMemberOfValidTeam(screenName, this.getAllAssociatedProjectTeams(gluonProject))) {
            throw new QMError(`ScreenName ${screenName} is not a member of project ${gluonProject.projectId}.`, this.teamMembershipMessages.notAMemberOfTheTeam());
        }
    }

    private getAllAssociatedProjectTeams(gluonProject) {
        const teams = [];
        gluonProject.teams.map(team => {
            teams.push(team.slack.teamChannel);
        });
        return teams;
    }

    private createMessageClient(ctx: HandlerContext,
                                teams: Array<{ slackIdentity: { teamChannel: string } }>) {
        const messageClient = new ChannelMessageClient(ctx);
        teams.map(team => {
            messageClient.addDestination(team.slackIdentity.teamChannel);
        });
        return messageClient;
    }
}
