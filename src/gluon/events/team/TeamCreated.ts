import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {
    addressSlackUsersFromContext,
    buttonForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import * as _ from "lodash";
import {NewOrUseTeamSlackChannel} from "../../commands/team/NewOrExistingTeamSlackChannel";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";

@EventHandler("Receive TeamCreated events", `
subscription TeamCreatedEvent {
  TeamCreatedEvent {
    id
    team {
      teamId
      name
      description
    }
    createdBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class TeamCreated extends BaseQMEvent implements HandleEvent<any> {

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested TeamCreated event: ${JSON.stringify(event.data)}`);
        this.succeedEvent();
        const teamCreatedEvent = event.data.TeamCreatedEvent[0];
        const text: string = `
${teamCreatedEvent.createdBy.firstName}, your ${teamCreatedEvent.team.name} team has been successfully created 👍.
Next you should configure your team Slack channel and OpenShift DevOps environment
                            `;
        const destination = await addressSlackUsersFromContext(ctx, teamCreatedEvent.createdBy.slackIdentity.screenName);
        const msg: SlackMessage = {
            text,
            attachments: [{
                fallback: "Next you should configure your team Slack channel and OpenShift DevOps environment",
                footer: `For more information, please read the ${DocumentationUrlBuilder.userGuide()}`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Team Slack channel"},
                        new NewOrUseTeamSlackChannel(),
                        {
                            teamName: teamCreatedEvent.team.name,
                            newTeamChannel: _.kebabCase(teamCreatedEvent.team.name),
                        }),
                ],
            }],
        };
        return await ctx.messageClient.send(msg,
            destination);
    }
}
