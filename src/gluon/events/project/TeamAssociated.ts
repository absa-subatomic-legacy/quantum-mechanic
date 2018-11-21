import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/spi/message/MessageClient";
import {url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";

@EventHandler("Receive TeamsLinkedToProject events", `
subscription TeamsLinkedToProjectEvent {
  TeamsLinkedToProjectEvent {
    id
    team {
      teamId
      name
      description
      slackIdentity {
        teamChannel
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
export class TeamsLinkedToProject extends BaseQMEvent implements HandleEvent<any> {

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested TeamAssociated event: ${JSON.stringify(event.data)}`);

        try {
            const teamsLinkedToProjectEvent = event.data.TeamsLinkedToProjectEvent[0];

            const destination =  await addressSlackChannelsFromContext(ctx, teamsLinkedToProjectEvent.team[0].slackIdentity.teamChannel);
            this.succeedEvent();
            return ctx.messageClient.send(`Your team has been successfully associated with ${teamsLinkedToProjectEvent.id}`,
                destination);
        } catch {
            this.failEvent();
        }
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/user-guide/create-a-team#associate-a-slack-channel`,
            "documentation")}`;
    }
}
