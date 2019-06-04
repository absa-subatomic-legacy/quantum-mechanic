import {HandlerContext, logger} from "@atomist/automation-client";
import {inviteUserToSlackChannel} from "@atomist/sdm-pack-lifecycle/lib/handlers/command/slack/AssociateRepo";
import * as graphql from "../typings/types";

export interface QMGraphClient {

    slackScreenNameFromSlackUserId(slackUserId: string): Promise<string>;

    slackChannelIdFromChannelName(channelName: string): Promise<string>;

    kickUserFromSlackChannel(slackTeamId: string, slackChannelId: string, slackUserId: string): Promise<string>;

    inviteUserToSlackChannel(slackTeamId: string, slackChannelId: string, slackUserId: string): Promise<any>;
}

export class AtomistQMGraphClient implements QMGraphClient {

    constructor(private ctx: HandlerContext) {
    }

    public async inviteUserToSlackChannel(slackTeamId: string, slackChannelId: string, slackUserId: string): Promise<any> {
        return await inviteUserToSlackChannel(this.ctx, slackTeamId, slackChannelId, slackUserId);
    }

    public async kickUserFromSlackChannel(slackTeamId: string, slackChannelId: string, slackUserId: string): Promise<string> {
        const KickUserFromSlackChannelMutation = `mutation kickUserFromSlackChannel(
    $teamId: String!
    $channelId: String!
    $userId: String!
  ) {
    kickUserFromSlackChannel(
      chatTeamId: $teamId
      channelId: $channelId
      userId: $userId
    ) {
      id
    }
  }
  `;

        return await this.ctx.graphClient.mutate<any, any>({
            mutation: KickUserFromSlackChannelMutation,
            variables: {
                teamId: slackTeamId,
                channelId: slackChannelId,
                userId: slackUserId,
            },
        });
    }

    public async slackChannelIdFromChannelName(channelName: string): Promise<string> {
        try {
            const result = await this.ctx.graphClient.query<graphql.ChatChannel.Query, graphql.ChatChannel.Variables>({
                name: "ChatChannel",
                variables: {name: channelName},
            });

            if (result) {
                if (result.ChatChannel && result.ChatChannel.length > 0) {
                    return result.ChatChannel[0].channelId;
                }
            }
        } catch (error) {
            logger.error("Error occurred running GraphQL query: %s", error);
        }
        return null;
    }

    public async slackScreenNameFromSlackUserId(slackUserId: string): Promise<string> {
        try {
            const result = await this.ctx.graphClient.query<graphql.ChatId.Query, graphql.ChatId.Variables>({
                name: "ChatId",
                variables: {userId: slackUserId},
            });

            if (result) {
                if (result.ChatId && result.ChatId.length > 0) {
                    return result.ChatId[0].screenName;
                }
            }
        } catch (error) {
            logger.error("Error occurred running GraphQL query: %s", error);
        }
        return null;
    }

}
