import {HandlerContext, logger} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {menuForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {Attachment} from "@atomist/slack-messages";

export function createAndSendMenu(ctx: HandlerContext, menuOptions: Array<{ value: string, text: string }>,
                                  command: HandleCommand, description: string, selectionMessage: string,
                                  resultVariableName: string, thumbUrl: string = ""): Promise<any> {
    const attachment: { [k: string]: any } = createMenuAttachment(menuOptions, command, "", description, selectionMessage, resultVariableName, thumbUrl);
    logger.info(JSON.stringify(menuOptions));
    return ctx.messageClient.respond({
        text: description,
        attachments: [
            attachment,
        ],
    });
}

export function createMenuAttachment(menuOptions: Array<{ value: string, text: string }>,
                                     command: HandleCommand, text: string, fallback: string, selectionMessage: string,
                                     resultVariableName: string, thumbUrl: string = ""): Attachment {
    const attachment: Attachment = {
        text,
        fallback,
        actions: [
            menuForCommand({
                    text: selectionMessage, options:
                    menuOptions,
                },
                command, resultVariableName),
        ],
    };
    if (thumbUrl.length > 0) {
        attachment.thumb_url = thumbUrl;
    }
    return attachment;
}
