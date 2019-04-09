import {HandlerContext, logger} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {Attachment} from "@atomist/slack-messages";
import * as _ from "lodash";
import * as graphql from "../../../typings/types";
import {QMMemberBase} from "../member/Members";
import {createMenuAttachment} from "../shared/GenericMenu";

export function menuAttachmentForTeams(ctx: HandlerContext, teams: any[],
                                       command: HandleCommand, message: string = "Please select a team",
                                       projectNameVariable: string = "teamName"): Attachment {
    return createMenuAttachment(
        teams.map(team => {
            return {
                value: team.name,
                text: team.name,
            };
        }),
        command,
        message,
        message,
        "Select Team",
        projectNameVariable,
    );
}

export async function loadChannelIdByChannelName(ctx: HandlerContext, name: string): Promise<string> {
    try {
        const result = await ctx.graphClient.query<graphql.ChatChannel.Query, graphql.ChatChannel.Variables>({
            name: "ChatChannel",
            variables: {name},
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

export function getDevOpsEnvironmentDetailsProd(teamName: string): DevOpsEnvironmentDetails {
    return getDevOpsEnvironmentDetails(teamName, "-prod");
}

export function getDevOpsEnvironmentDetails(teamName: string, postfix: string = ""): DevOpsEnvironmentDetails {
    return {
        openshiftProjectId: `${_.kebabCase(teamName).toLowerCase()}-devops${postfix}`,
        name: `${teamName} DevOps`,
        description: `DevOps environment for ${teamName} [managed by Subatomic]`,
    };
}

export function getTeamSlackChannel(team: { slack?: { teamChannel: string } }) {
    if (!_.isEmpty(team.slack)) {
        return team.slack.teamChannel;
    }
    return undefined;
}

export interface DevOpsEnvironmentDetails {
    openshiftProjectId: string;
    name: string;
    description: string;
}

export function isUserAMemberOfTheTeam(user: QMMemberBase, team: QMTeam) {
    for (const member of team.members) {
        if (user.memberId === member.memberId) {
            return true;
        }
    }

    for (const owner of team.owners) {
        if (user.memberId === owner.memberId) {
            return true;
        }
    }

    return false;
}

export interface QMTeamSlack {
    teamChannel: string;
}

export interface QMTeamBase {
    teamId: string;
    name: string;
    openShiftCloud: string;
    description: string;
    slack?: QMTeamSlack;
}

export interface QMTeam extends QMTeamBase {
    owners: QMMemberBase[];
    members: QMMemberBase[];
}

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

export function isOwner(
    team: QMTeam,
    memberId: string,
) {
    return team.owners.some(owner => owner.memberId === memberId);
}

export function isMember(
    team: QMTeam,
    memberId: string,
) {
    return team.members.some(member => member.memberId === memberId);
}
