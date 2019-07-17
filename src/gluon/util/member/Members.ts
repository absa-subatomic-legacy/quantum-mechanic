import {HandlerContext, logger} from "@atomist/automation-client";
import * as graphql from "../../../typings/types";

export function userFromDomainUser(domainUsername: string, usernameCase = "lower"): string {

    if (usernameCase === "lower") {
        domainUsername = domainUsername.toLowerCase();
    } else {
        domainUsername = domainUsername.toUpperCase();
    }
    return /[^\\]*$/.exec(domainUsername)[0];
}

export async function loadScreenNameByUserId(ctx: HandlerContext, userId: string): Promise<string> {
    try {
        const result = await ctx.graphClient.query<graphql.ChatId.Query, graphql.ChatId.Variables>({
            name: "ChatId",
            variables: {userId},
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

export enum MemberRole {
    owner = "Owner",
    member = "Member",
}
