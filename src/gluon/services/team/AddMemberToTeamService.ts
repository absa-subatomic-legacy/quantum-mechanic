import {HandlerContext, logger} from "@atomist/automation-client";
import {
    addressSlackChannelsFromContext,
    buttonForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {inviteUserToSlackChannel} from "@atomist/sdm-pack-lifecycle/lib/handlers/command/slack/AssociateRepo";
import {SlackMessage} from "@atomist/slack-messages";
import {inspect} from "util";
import {QMContext} from "../../../context/QMContext";
import {isSuccessCode} from "../../../http/Http";
import {CommandIntent} from "../../commands/CommandIntent";
import {OnboardMember} from "../../commands/member/OnboardMember";
import {AddMemberToTeam} from "../../commands/team/AddMemberToTeam";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {AddMemberToTeamMessages} from "../../messages/team/AddMemberToTeamMessages";
import {MemberRole} from "../../util/member/Members";
import {QMColours} from "../../util/QMColour";
import {QMError} from "../../util/shared/Error";
import {loadChannelIdByChannelName} from "../../util/team/Teams";
import {GluonService} from "../gluon/GluonService";

export class AddMemberToTeamService {

    public addMemberToTeamMessages: AddMemberToTeamMessages = new AddMemberToTeamMessages();

    constructor(private gluonService = new GluonService()) {
    }

    public async getNewMemberGluonDetails(ctx: QMContext, slackUserId: string, teamChannel: string) {
        try {
            return await this.gluonService.members.gluonMemberFromSlackUserId(slackUserId);
        } catch (error) {
            const isQMError = error instanceof QMError;
            if (!isQMError || (isQMError && error.message === `${slackUserId} is already a member of this team.`)) {
                throw error;
            }
            await this.onboardMessage(ctx, slackUserId, teamChannel);
            const errorMessage = `Failed to get member's details. Member *${slackUserId}* appears to not be onboarded.`;
            const msg: SlackMessage = {
                text: errorMessage,
                attachments: [{
                    text: `
They have been sent a request to onboard, once they've successfully onboarded you can re-run the command or click the button below.
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

    public async inviteUserToSlackChannel(ctx: HandlerContext,
                                          newMemberFirstName: string,
                                          gluonTeamName: string,
                                          channelName: string,
                                          screenName: string,
                                          slackName: string) {
        const destination = await addressSlackChannelsFromContext(ctx, channelName);
        try {
            logger.info(`Added team member! Inviting to channel [${channelName}] -> member [${screenName}]`);
            const channelId = await loadChannelIdByChannelName(ctx, channelName);
            logger.info("Channel ID: " + channelId);
            await inviteUserToSlackChannel(ctx,
                ctx.workspaceId,
                channelId,
                screenName);

            const message = this.addMemberToTeamMessages.welcomeMemberToTeam(newMemberFirstName, gluonTeamName);

            return await ctx.messageClient.send(message, destination);
        } catch (error) {
            logger.warn(error);
            return await ctx.messageClient.send(`User ${slackName} successfully added to your team.` +
                ` Private channels do not currently support automatic user invitation.` +
                ` Please invite the user to this slack channel manually.`, destination);
        }
    }

    public async addUserToGluonTeam(newMemberId: string, actioningMemberId: string, gluonTeamId: string, memberRole: MemberRole = MemberRole.member) {
        logger.info(`Adding member [${newMemberId}] to team ${gluonTeamId}`);

        const memberDetails = {
            members: [],
            owners: [],
            createdBy: actioningMemberId,
        };

        if (memberRole === MemberRole.owner) {
            memberDetails.owners.push(
                {
                    memberId: newMemberId,
                },
            );
        } else {
            memberDetails.members.push(
                {
                    memberId: newMemberId,
                },
            );
        }

        const updateTeamResult = await this.gluonService.teams.addMemberToTeam(gluonTeamId,
            memberDetails);

        if (!isSuccessCode(updateTeamResult.status)) {
            let message = `Failed to add member to the team. Server side failure.`;
            const errorMessage = `Failed to add member to the team. ${inspect(updateTeamResult)}`;
            logger.error(message);
            if (updateTeamResult.status === 403) {
                message = `Unauthorized: Sorry only a team owner can add members to a team.`;
            }
            throw new QMError(errorMessage, message);
        }
    }

    public verifyAddMemberRequest(newMember: { memberId: string, slack: { screenName: string } }, team: { owners: Array<{ memberId: string }>, members: Array<{ memberId: string }> }, memberRole: MemberRole) {
        if (memberRole === MemberRole.owner) {
            for (const owner of team.owners) {
                if (owner.memberId === newMember.memberId) {
                    throw new QMError(`${newMember.slack.screenName} is already an owner of this team.`);
                }
            }
        } else {
            for (const member of team.members) {
                if (member.memberId === newMember.memberId) {
                    throw new QMError(`${newMember.slack.screenName} is already a member of this team.`);
                }
            }
        }
    }

    private async onboardMessage(ctx: QMContext, chatId: string, teamChannel: string) {
        const msg: SlackMessage = {
            text: `Someone tried to add you to the team channel ${teamChannel}.`,
            attachments: [{
                text: `
Unfortunately you do not seem to have been onboarded to Subatomic.
Click the button below to do that now.
                            `,
                fallback: "You are not onboarded to Subatomic",
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.AddMemberToTeam)}`,
                color: QMColours.stdMuddyYellow.hex,
                mrkdwn_in: ["text"],
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {
                            text: "Onboard me",
                        },
                        new OnboardMember()),
                ],
            }],
        };
        return await ctx.messageClient.sendToUsers(msg, chatId);
    }
}
