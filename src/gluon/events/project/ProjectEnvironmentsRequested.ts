import {
    addressSlackChannelsFromContext,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {QMConfig} from "../../../config/QMConfig";
import {AtomistQMContext} from "../../../context/QMContext";
import {ChannelMessageClient} from "../../../context/QMMessageClient";
import {ProjectMessages} from "../../messages/projects/ProjectMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigureJenkinsForProject} from "../../tasks/project/ConfigureJenkinsForProject";
import {CreateOpenshiftEnvironments} from "../../tasks/project/CreateOpenshiftEnvironments";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {
    getAllPipelineOpenshiftNamespacesForAllPipelines,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {handleQMError} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";

@EventHandler("Receive ProjectEnvironmentsRequestedEvent events", `
subscription ProjectEnvironmentsRequestedEvent {
  ProjectEnvironmentsRequestedEvent {
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
      openShiftCloud
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
export class ProjectEnvironmentsRequested extends BaseQMEvent implements HandleEvent<any> {

    private qmMessageClient: ChannelMessageClient;
    private projectMessages = new ProjectMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectEnvironmentsRequestedEvent event: ${JSON.stringify(event.data)}`);

        const environmentsRequestedEvent = event.data.ProjectEnvironmentsRequestedEvent[0];

        this.qmMessageClient = this.createMessageClient(ctx, environmentsRequestedEvent.teams);

        try {
            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(environmentsRequestedEvent.project.name);
            const owningTeam: QMTeam = await this.gluonService.teams.getTeamById(project.owningTeam.teamId);

            logger.debug(`ProjectEnvironmentsRequested.owningTeam: ${JSON.stringify(owningTeam)}`);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Provisioning of environment's for project *${environmentsRequestedEvent.project.name}* started:`,
                this.qmMessageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);
            const openshiftNonProd = QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd;

            const environmentsForCreation: OpenShiftProjectNamespace[] = getAllPipelineOpenshiftNamespacesForAllPipelines(environmentsRequestedEvent.owningTenant.name, project);

            taskRunner.addTask(
                new CreateOpenshiftEnvironments(new AtomistQMContext(ctx), environmentsRequestedEvent, environmentsForCreation, openshiftNonProd, owningTeam),
            ).addTask(
                new ConfigureJenkinsForProject(environmentsRequestedEvent, project.devDeploymentPipeline, project.releaseDeploymentPipelines, openshiftNonProd),
            );

            await taskRunner.execute(ctx);
            this.succeedEvent();
            return await this.sendPackageUsageMessage(ctx, environmentsRequestedEvent.project.name, environmentsRequestedEvent.teams);
        } catch (error) {
            this.failEvent();
            return await handleQMError(this.qmMessageClient, error);
        }
    }

    private createMessageClient(ctx: HandlerContext, teams) {
        const messageClient = new ChannelMessageClient(ctx);
        teams.map(team => {
            messageClient.addDestination(team.slackIdentity.teamChannel);
        });
        return messageClient;
    }

    private async sendPackageUsageMessage(ctx: HandlerContext, projectName: string, teams) {
        const destination = await addressSlackChannelsFromContext(ctx, ...teams.map(team =>
            team.slackIdentity.teamChannel));
        return await ctx.messageClient.send(this.projectMessages.packageUsageMessage(projectName), destination);
    }

}
