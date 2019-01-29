import {HandlerContext, logger} from "@atomist/automation-client";
import {
    addressSlackChannelsFromContext,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {inviteUserToSlackChannel} from "@atomist/lifecycle-automation/lib/handlers/command/slack/AssociateRepo";
import {loadChannelIdByChannelName} from "../../util/team/Teams";

export class OnboardMemberService {

    public async inviteUserToSecondarySlackChannel(ctx: HandlerContext,
                                                   newMemberFirstName: string,
                                                   channelName: string,
                                                   slackUserID: string,
                                                   slackScreenName: string) {

        const destination = await addressSlackChannelsFromContext(ctx, channelName);
        try {
            logger.info(`Added team member! Inviting to channel [${channelName}] -> member [${slackUserID}]`);
            const slackChannelId = await loadChannelIdByChannelName(ctx, channelName);
            logger.info("Channel ID: " + slackChannelId);

            await inviteUserToSlackChannel(ctx,
                destination.team, // NOTE: this is the Slack Workspace ID not the Atomist Workspace ID (they used to be the same)
                slackChannelId,
                slackUserID);

            return channelName;
        } catch (error) {
            logger.warn(`inviteUserToCustomSlackChannel warning: ${JSON.stringify(error)}`);
            const msg = `Invitation to channel *${channelName}* failed for *${slackScreenName}*.\n Note, private channels do not currently support automatic user invitation.\n` +
                `Please invite the user to this slack channel manually.`;
            return await ctx.messageClient.send(msg, destination);
        }
    }
}
