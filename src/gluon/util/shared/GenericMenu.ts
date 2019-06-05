import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {menuForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {Attachment} from "@atomist/slack-messages";

export function createSortedMenuAttachment(menuOptions: Array<{ value: string, text: string }>,
                                           command: HandleCommand, slackMessageDetails: { text: string, fallback: string, selectionMessage: string, resultVariableName: string, thumbUrl?: string }) {
    return createMenuAttachment(menuOptions.sort((a, b) => (a.text > b.text) ? 1 : -1), command, slackMessageDetails);
}

export function createMenuAttachment(menuOptions: Array<{ value: string, text: string }>,
                                     command: HandleCommand,
                                     slackMessageDetails: { text: string, fallback: string, selectionMessage: string, resultVariableName: string, thumbUrl?: string }): Attachment {
    return {
        text: slackMessageDetails.text,
        fallback: slackMessageDetails.fallback,
        actions: [
            menuForCommand({
                    text: slackMessageDetails.selectionMessage, options:
                    menuOptions,
                },
                command, slackMessageDetails.resultVariableName),
        ],
        thumb_url: slackMessageDetails.thumbUrl,
    };
}
