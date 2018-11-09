import { HandlerContext } from "@atomist/automation-client";

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

export function kickUserFromSlackChannel(
    ctx: HandlerContext,
    teamId: string,
    channelId: string,
    userId: string,
): Promise<any> {

    return ctx.graphClient.mutate<any, any>({
        mutation: KickUserFromSlackChannelMutation,
        variables: {
            teamId,
            channelId,
            userId,
        },
    });
}
