import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {addressSlackUsers} from "@atomist/automation-client/spi/message/MessageClient";
import {inviteUserToSlackChannel} from "@atomist/lifecycle-automation/handlers/command/slack/AssociateRepo";
import {SlackMessage} from "@atomist/slack-messages";
import axios from "axios";
import {QMConfig} from "../../config/QMConfig";

@CommandHandler("Close a membership request")
@Tags("subatomic", "team", "membership")
export class MembershipRequestClosed implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public approverUserName: string;

    @MappedParameter(MappedParameters.SlackTeam)
    public slackTeam: string;

    @MappedParameter(MappedParameters.SlackChannel)
    public slackChannelId: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "Gluon team id",
    })
    public teamId: string;

    @Parameter({
        description: "Name of the team",
    })
    public teamName: string;

    @Parameter({
        description: "Membership request id",
    })
    public membershipRequestId: string;

    @Parameter({
        description: "Slack name of applying user",
    })
    public userScreenName: string;

    @Parameter({
        description: "Slack id of applying user",
    })
    public userSlackId: string;

    @Parameter({
        description: "Status of request approval",
    })
    public approvalStatus: string;

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Attempting approval from user: ${this.approverUserName}`);

        const approverMemberQueryResult = await this.findGluonTeamMember(this.approverUserName);

        if (approverMemberQueryResult.status !== 200) {
            logger.error("The approver is not a gluon member. This can only happen if the user was deleted before approving this request.");
            return await ctx.messageClient.respond("❗You are no longer a Subatomic user.");
        }

        const approverMember = approverMemberQueryResult.data._embedded.teamMemberResources[0];

        const updateMembershipRequestResult = await this.updateGluonMembershipRequest(
            this.teamId,
            this.membershipRequestId,
            approverMember.memberId,
            this.approvalStatus,
        );

        if (updateMembershipRequestResult.status !== 200) {
            logger.error("Failed to update the member shiprequest.");
            return await ctx.messageClient.respond("❗The membership request could not be updated. Please ensure that you are an owner of this team before responding to the membership request.");
        }

        return await this.handleMembershipRequestResult(ctx);
    }

    private async findGluonTeamMember(slackScreenName: string) {
        return await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${slackScreenName}`);
    }

    private async updateGluonMembershipRequest(teamId: string, membershipRequestId: string, approvedByMemberId: string, approvalStatus: string) {
        return await axios.put(
            `${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            {
                membershipRequests: [
                    {
                        membershipRequestId,
                        approvedBy: {
                            memberId: approvedByMemberId,
                        },
                        requestStatus: approvalStatus,
                    }],
            });
    }

    private async handleMembershipRequestResult(ctx: HandlerContext) {
        if (this.approvalStatus === "APPROVED") {
            return await this.handleApprovedMembershipRequest(ctx, this.slackChannelId, this.userScreenName, this.slackTeam, this.approverUserName, this.teamChannel);
        } else {
            return await this.handleRejectedMembershipRequest(ctx, this.teamName, this.approverUserName, this.userScreenName, this.teamChannel);
        }
    }

    private async handleApprovedMembershipRequest(ctx: HandlerContext, slackChannelId: string, approvedUserScreenName: string, slackTeam: string, approvingUserSlackId: string, slackTeamChannel: string) {
        logger.info(`Added team member! Inviting to channel [${slackChannelId}] -> member @${approvedUserScreenName}`);
        await inviteUserToSlackChannel(ctx,
            slackTeam,
            slackChannelId,
            approvingUserSlackId);

        const msg: SlackMessage = {
            text: `Welcome to the team *@${approvedUserScreenName}*!`,
        };
        return await ctx.messageClient.addressChannels(msg, slackTeamChannel);
    }

    private async handleRejectedMembershipRequest(ctx: HandlerContext, teamName: string, rejectingUserScreenName: string, rejectedUserScreenName: string, teamChannel: string) {
        await ctx.messageClient.send(`Your membership request to team '${teamName}' has been rejected by @${rejectingUserScreenName}`,
            addressSlackUsers(QMConfig.teamId, rejectedUserScreenName));

        return await ctx.messageClient.addressChannels("Membership request rejected", teamChannel);
    }
}
