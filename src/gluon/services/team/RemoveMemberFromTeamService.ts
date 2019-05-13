import {HandlerContext, logger} from "@atomist/automation-client";
import {
    addressSlackChannelsFromContext,
    buttonForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {isSuccessCode} from "../../../http/Http";
import {CommandIntent} from "../../commands/CommandIntent";
import {AddMemberToTeam} from "../../commands/team/AddMemberToTeam";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {MemberRole, QMMemberBase} from "../../util/member/Members";
import {QMColours} from "../../util/QMColour";
import {QMError} from "../../util/shared/Error";
import {
    kickUserFromSlackChannel,
    loadChannelIdByChannelName,
    QMTeam,
} from "../../util/team/Teams";
import {GluonService} from "../gluon/GluonService";

export class RemoveMemberFromTeamService {

    constructor(private gluonService = new GluonService()) {
    }

    public async getMemberGluonDetails(ctx: HandlerContext, chatId: string) {
        try {
            return await this.gluonService.members.gluonMemberFromScreenName(chatId);
        } catch (error) {
            const isQMError = error instanceof QMError;
            if (!isQMError || (isQMError && error.message === `${chatId} is already a member of this team.`)) {
                throw error;
            }

            const errorMessage = `Failed to get member's details. Member *${chatId}* appears to not be onboarded.`;
            const msg: SlackMessage = {
                text: errorMessage,
                attachments: [{
                    text: `They have been sent a request to onboard, once they've successfully onboarded you can re-run
                     the command or click the button below.
                            `,
                    fallback: "Failed to get member details.",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.AddMemberToTeam)}`,
                    color: QMColours.stdMuddyYellow.hex,
                    mrkdwn_in: ["text"],
                    thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                    actions: [
                        buttonForCommand(
                            {text: "Add team members"},
                            new AddMemberToTeam()),
                    ],
                }],
            };
            throw new QMError(errorMessage, msg);
        }
    }

    public async removeUserFromGluonTeam(memberId: string, actioningMemberId: string, gluonTeamId: string) {
        const updateTeamResult = await this.gluonService.teams.removeMemberFromTeam(gluonTeamId, memberId, actioningMemberId);
        if (!isSuccessCode(updateTeamResult.status)) {
            let message = `Failed to remove member from the team.`;
            logger.error(`${message} | data: ${JSON.stringify(updateTeamResult.data)}`);
            if (updateTeamResult.status === 403) {
                message = `Unauthorized: ${message} Sorry only a team owner can remove members from a team.`;
            }
            throw new QMError(message);
        }
    }

    public verifyCanRemoveMemberRequest(memberToRemove: QMMemberBase, team: QMTeam, memberRole: MemberRole) {
        if (memberRole !== MemberRole.owner) {
            let found: boolean = false;
            for (const member of team.members) {
                if (member.memberId === memberToRemove.memberId) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                throw new QMError(`${memberToRemove.slack.screenName} is not a member of this team`);
            }
        } else {
            if (team.owners.length === 1) {
                throw new QMError(`${memberToRemove.slack.screenName} is the only owner of this team and cannot be removed.`);
            }
        }
    }

    public async removeUserFromSlackChannel(ctx: HandlerContext,
                                            newMemberFirstName: string,
                                            gluonTeamName: string,
                                            channelName: string,
                                            slackUserId: string,
                                            slackName: string) {
        const destination = await addressSlackChannelsFromContext(ctx, channelName);
        try {
            logger.info(`Removing user ${slackUserId} from channel ${channelName}...`);
            const channelId = await loadChannelIdByChannelName(ctx, channelName);
            logger.info("Channel ID: " + channelId);

            const chatTeamId = destination.team;
            await kickUserFromSlackChannel(ctx, chatTeamId, channelId, slackUserId);

            const message = `${slackName} has been removed from the Slack channel: ${channelName}`;
            return await ctx.messageClient.send(message, destination);
        } catch (error) {
            throw new QMError(error,
                `Failed to remove ${slackName} from ${channelName}. The user might already have been removed or has already left. Please double check and remove the user manually if required.`);
        }
    }
}
