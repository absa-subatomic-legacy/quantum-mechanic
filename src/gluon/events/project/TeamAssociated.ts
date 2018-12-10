import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import _ = require("lodash");
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient} from "../../util/shared/Error";

@EventHandler("Receive TeamsLinkedToProject events", `
subscription TeamsLinkedToProjectEvent {
  TeamsLinkedToProjectEvent {
    id
    project {
      projectId
      name
      description
    }
    teams {
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
            const messageClient = new ChannelMessageClient(ctx);
            const teams = teamsLinkedToProjectEvent.teams;
            for (const team of teams) {
                if (!_.isEmpty(team.slackIdentity)) {
                    messageClient.addDestination(team.slackIdentity.teamChannel);
                }
            }
            this.succeedEvent();
            return messageClient.send(`Your team has been successfully associated with the *${teamsLinkedToProjectEvent.project.name}* project.`);
        } catch (error) {
            this.failEvent();
        }
    }
}
