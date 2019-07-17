import * as _ from "lodash";

export function slackUserIdToSlackHandle(slackUserId: string) {
    return `<@${slackUserId}>`;
}

export function slackHandleToSlackUserId(slackHandle: string) {
    let result = slackHandle;
    if (slackHandle.startsWith("<@")) {
        result = _.replace(slackHandle, /(<@)|>/g, "");
    }
    return result.trim();
}
