import {
    addressSlackChannelsFromContext,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {addressEvent} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {timeout, TimeoutError} from "promise-timeout";
import {QMConfig} from "../../../config/QMConfig";
import {ChannelMessageClient} from "../../../context/QMMessageClient";
import {DevOpsMessages} from "../../messages/team/DevOpsMessages";
import {OCService} from "../../services/openshift/OCService";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {AddJenkinsToDevOpsEnvironment} from "../../tasks/team/AddJenkinsToDevOpsEnvironment";
import {CreateTeamDevOpsEnvironment} from "../../tasks/team/CreateTeamDevOpsEnvironment";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {handleQMError} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {EventToGluon} from "../../util/transform/EventToGluon";

@EventHandler("Receive DevOpsEnvironmentRequestedEvent events", `
subscription DevOpsEnvironmentRequestedEvent {
  DevOpsEnvironmentRequestedEvent {
    id
    team {
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
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class DevOpsEnvironmentRequested extends BaseQMEvent implements HandleEvent<any> {

    private devopsMessages = new DevOpsMessages();

    constructor(private ocService: OCService = new OCService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested DevOpsEnvironmentRequestedEvent event: ${JSON.stringify(event.data)}`);

        const devOpsRequestedEvent = event.data.DevOpsEnvironmentRequestedEvent[0];

        try {
            const teamChannel = devOpsRequestedEvent.team.slackIdentity.teamChannel;
            const team: QMTeam = EventToGluon.gluonTeam(devOpsRequestedEvent.team);
            const taskListMessage = new TaskListMessage(`🚀 Provisioning of DevOps environment for team *${devOpsRequestedEvent.team.name}* started:`, new ChannelMessageClient(ctx).addDestination(teamChannel));
            const taskRunner = new TaskRunner(taskListMessage);
            const openShiftCloud = EventToGluon.gluonTeam(devOpsRequestedEvent.team).openShiftCloud;
            taskRunner.addTask(
                new CreateTeamDevOpsEnvironment(team, QMConfig.subatomic.openshiftClouds[openShiftCloud].openshiftNonProd),
            ).addTask(
                new AddJenkinsToDevOpsEnvironment(team),
            );

            await taskRunner.execute(ctx);

            await this.sendDevOpsSuccessfullyProvisionedMessage(ctx, team);

            const devopsEnvironmentProvisionedEvent = {
                team: devOpsRequestedEvent.team,
                devOpsEnvironment: getDevOpsEnvironmentDetails(devOpsRequestedEvent.team.name),
            };
            this.succeedEvent();
            return await ctx.messageClient.send(devopsEnvironmentProvisionedEvent, addressEvent("DevOpsEnvironmentProvisionedEvent"));

        } catch (error) {
            this.failEvent();
            return await this.handleError(ctx, error, devOpsRequestedEvent.team.slackIdentity.teamChannel);
        }
    }

    private async sendDevOpsSuccessfullyProvisionedMessage(ctx: HandlerContext, team: QMTeam) {

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd);

        const jenkinsHost = await this.ocService.getJenkinsHost(getDevOpsEnvironmentDetails(team.name).openshiftProjectId);

        const destination = await addressSlackChannelsFromContext(ctx, team.slack.teamChannel);
        await ctx.messageClient.send(
            this.devopsMessages.jenkinsSuccessfullyProvisioned(jenkinsHost, team.name),
            destination,
        );
    }

    private async handleError(ctx: HandlerContext, error, teamChannel: string) {
        return await handleQMError(new ChannelMessageClient(ctx).addDestination(teamChannel), error);
    }
}
