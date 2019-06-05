import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    success,
    Tags,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {
    addressSlackChannelsFromContext,
    buttonForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import _ = require("lodash");
import {ChannelMessageClient} from "../../../context/QMMessageClient";
import {OnboardMember} from "../../commands/member/OnboardMember";
import {AddMemberToTeam} from "../../commands/team/AddMemberToTeam";
import {NewDevOpsEnvironment} from "../../commands/team/DevOpsEnvironment";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    handleQMError,
    QMError,
} from "../../util/shared/Error";

@EventHandler("Display a helpful message when the bot joins a channel",
    `subscription BotJoinedChannel {
  UserJoinedChannel {
    user {
      isAtomistBot
      screenName
      userId
    }
    channel {
      botInvitedSelf
      channelId
      name
      repos {
        name
        owner
        org {
          provider {
            url
          }
        }
      }
      team {
        id
        orgs {
          owner
          ownerType
          provider {
            apiUrl
          }
          repo {
            name
            owner
          }
        }
      }
    }
  }
}`)
@Tags("atomist", "channel")
export class BotJoinedChannel extends BaseQMEvent implements HandleEvent<any> {

    @MappedParameter(MappedParameters.SlackChannelName)
    public slackChannelName: string;

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        const botJoinedChannel = event.data.UserJoinedChannel[0];
        logger.info(`BotJoinedChannelEvent: ${JSON.stringify(botJoinedChannel)}`);

        const teams = await this.getTeams(botJoinedChannel.channel.name);
        if (teams == null) {
            return await success();
        }

        try {
            if (botJoinedChannel.user.isAtomistBot === "true") {
                const channelNameString = `the ${botJoinedChannel.channel.name}`;
                this.succeedEvent();
                return await this.sendBotTeamWelcomeMessage(ctx, channelNameString, botJoinedChannel.channel.channelId);
            } else {
                return this.processUserJoinedChannelEvent(ctx, botJoinedChannel);
            }
        } catch (error) {
            this.failEvent();
            return await handleQMError(new ChannelMessageClient(ctx).addDestination(botJoinedChannel.channel.channelId), error);
        }
    }

    private async processUserJoinedChannelEvent(ctx: HandlerContext, botJoinedChannel: any) {
        const userName = botJoinedChannel.user.screenName;

        logger.info("Checking whether the user onboarded");
        const destination = await addressSlackChannelsFromContext(ctx, botJoinedChannel.channel.channelId);
        let existingUser;
        try {
            existingUser = await this.gluonService.members.gluonMemberFromScreenName(userName);

            logger.info("Checking whether the user is a part of the team");
            for (const team of existingUser.teams) {
                if (!_.isEmpty(team.slack) && team.slack.teamChannel === botJoinedChannel.channel.name) {
                    logger.info("User is a part of this team.");
                    return await success();
                }
            }
            const slackMessage: SlackMessage = {
                text: `Welcome to *${botJoinedChannel.channel.name}* team channel @${userName}!`,
                attachments: [{
                    fallback: `Welcome to *${botJoinedChannel.channel.name}* team channel!`,
                    text: "You are not part of this team. To join this team get a team owner (`sub list team members`) to add you.",
                    actions: [
                        buttonForCommand(
                            {
                                text: `Add ${userName}`,
                                style: "primary",
                            },
                            new AddMemberToTeam(),
                            {
                                slackName: botJoinedChannel.user.userId
                                ,
                            }),
                    ],
                }],
            };
            return ctx.messageClient.send(slackMessage, destination);
        } catch (error) {
            const msg: SlackMessage = {
                text: `Welcome to *${botJoinedChannel.channel.name}* team channel @${userName}!`,
                attachments: [{
                    fallback: `Welcome to *${botJoinedChannel.channel.name}* team channel!`,
                    text: "You don't have a Subatomic account",
                    actions: [
                        buttonForCommand(
                            {
                                text: "Onboard me",
                            },
                            new OnboardMember()),
                    ],
                }],
            };
            return ctx.messageClient.send(msg, destination);
        }
    }

    private async sendBotTeamWelcomeMessage(ctx: HandlerContext, channelNameString: string, channelId: string) {
        const msg: SlackMessage = {
            text: `Welcome to *${channelNameString}* team channel!`,
            attachments: [{
                fallback: `Welcome to the *${channelNameString}* team channel!`,
                footer: `For more information, please read the ${DocumentationUrlBuilder.generalCommandReference()}`,
                text: `
If you haven't already, you might want to:

• create an OpenShift DevOps environment
• add new team members
                                                          `,
                mrkdwn_in: ["text"],
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Create DevOps environment"},
                        new NewDevOpsEnvironment()),
                    buttonForCommand(
                        {text: "Add team members"},
                        new AddMemberToTeam()),
                ],
            }],
        };
        const destination = await addressSlackChannelsFromContext(ctx, channelId);
        return await ctx.messageClient.send(msg, destination);
    }

    private async getTeams(channelName: string) {
        let result = null;
        try {
            result = await this.gluonService.teams.getTeamsBySlackTeamChannel(channelName);
        } catch (error) {
            if (!(error instanceof QMError)) {
                throw error;
            }
        }
        return result;
    }
}
