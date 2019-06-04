import {logger} from "@atomist/automation-client";
import {QMContext} from "../../../context/QMContext";

export class OnboardMemberService {

    public async inviteUserToSecondarySlackChannel(ctx: QMContext,
                                                   slackTeamId: string,
                                                   newMemberFirstName: string,
                                                   channelName: string,
                                                   slackUserID: string,
                                                   slackScreenName: string) {

        try {
            logger.info(`Added team member! Inviting to channel [${channelName}] -> member [${slackUserID}]`);
            const slackChannelId = await ctx.graphClient.slackChannelIdFromChannelName(channelName);
            logger.info("Channel ID: " + slackChannelId);

            await ctx.graphClient.inviteUserToSlackChannel(slackTeamId, slackChannelId, slackUserID);

            return channelName;
        } catch (error) {
            logger.warn(`inviteUserToCustomSlackChannel warning: ${JSON.stringify(error)}`);
            const msg = `Invitation to channel *${channelName}* failed for *${slackScreenName}*.\n Note, private channels do not currently support automatic user invitation.\n` +
                `Please invite the user to this slack channel manually.`;
            return await ctx.messageClient.sendToChannels(msg, channelName);
        }
    }
}
