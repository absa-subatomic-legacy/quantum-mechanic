import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {SlackMessage} from "@atomist/slack-messages";
import {
    SimpleQMMessageClient,
} from "../../../context/QMMessageClient";
import {ChannelMessageClient} from "../../../context/QMMessageClient";
import {CommandIntent} from "../../commands/CommandIntent";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {CreateConfigServer} from "../../tasks/team/CreateConfigServer";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    handleQMError,
    } from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";
import {GluonTeamEvent} from "../../util/transform/types/event/GluonTeamEvent";
import {MemberEvent} from "../../util/transform/types/event/MemberEvent";

@EventHandler("Receive ConfigServerRequested events", `
subscription ConfigServerRequestedEvent {
  ConfigServerRequestedEvent {
    id
    team{
      name
      openShiftCloud
      slackIdentity {
        teamChannel
      }
    }
    actionedBy{
      firstName
      slackIdentity {
        screenName
      }
    }
    configRepositoryGitURI
  }
}
`)
export class ConfigServerRequested extends BaseQMEvent implements HandleEvent<any> {

    constructor() {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ConfigServerRequested event: ${JSON.stringify(event.data)}`);
        const configServerRequestedEvent: ConfigServerRequestedEvent = event.data.ConfigServerRequestedEvent[0];

        const messageClient: SimpleQMMessageClient = new ChannelMessageClient(ctx).addDestination(configServerRequestedEvent.team.slackIdentity.teamChannel);

        try {
            const taskListMessage = new TaskListMessage(`:rocket: Deploying config server into *${configServerRequestedEvent.team.name}* team DevOps...`, messageClient);
            const taskRunner = new TaskRunner(taskListMessage);

            taskRunner.addTask(new CreateConfigServer(configServerRequestedEvent.team.name, configServerRequestedEvent.team.openShiftCloud, configServerRequestedEvent.configRepositoryGitURI));

            await taskRunner.execute(ctx);
            this.succeedEvent();
            return await this.sendSuccessResponse(messageClient, configServerRequestedEvent.team.name);
        } catch (error) {
            this.failEvent();
            return await handleQMError(messageClient, error);
        }
    }

    private async sendSuccessResponse(messageClient: SimpleQMMessageClient, gluonTeamName: string) {
        const devOpsProjectId = getDevOpsEnvironmentDetails(gluonTeamName).openshiftProjectId;
        const slackMessage: SlackMessage = {
            text: `Your Subatomic Config Server has been added to your *${devOpsProjectId}* OpenShift project successfully`,
            attachments: [{
                fallback: `Your Subatomic Config Server has been added successfully`,
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.AddConfigServer)}`,
            }],
        };

        return await messageClient.send(slackMessage);
    }
}

export interface ConfigServerRequestedEvent {
    team: GluonTeamEvent;
    actionedBy: MemberEvent;
    configRepositoryGitURI: string;
}
