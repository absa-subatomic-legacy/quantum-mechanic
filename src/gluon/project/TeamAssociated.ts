import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {addressSlackUsers} from "@atomist/automation-client/spi/message/MessageClient";
import {url} from "@atomist/slack-messages";
import {QMConfig} from "../../config/QMConfig";

@EventHandler("Receive TeamAssociated events", `
subscription TeamAssociatedEvent {
  TeamAssociatedEvent {
    id
    team {
      teamId
      name
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
export class TeamAssociated implements HandleEvent<any> {

    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested TeamAssociated event: ${JSON.stringify(event.data)}`);

        // TODO if team channel already exists, then send a message there about the new Subatomic team
        // also update the Team with that existing team channel

        const teamAssociatedEvent = event.data.TeamAssociatedEvent[0];

        // TODO fix the below if not created from Slack
        return ctx.messageClient.send("asdas",
            addressSlackUsers(QMConfig.teamId, teamAssociatedEvent.requestedBy.slackIdentity.screenName));
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/user-guide/create-a-team#associate-a-slack-channel`,
            "documentation")}`;
    }
}
