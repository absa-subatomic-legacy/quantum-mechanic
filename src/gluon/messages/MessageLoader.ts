import {logger} from "@atomist/automation-client";
import {SlackMessage} from "@atomist/slack-messages";
import fs = require("fs");
import stripJsonComments = require("strip-json-comments");

export class MessageLoader {

    public static msg: SlackMessage;

    public static initialize() {
        const msgRaw = stripJsonComments(fs.readFileSync(this.getMessageFile()).toString());
        const msg = JSON.parse(msgRaw);
        MessageLoader.msg = msg;
        }

    private static filename: string;

    private static getMessageFile() {
        let msgFile = "";
        logger.info(`Searching folder: message file overrides/`);
        fs.readdirSync(`resources/templates/messages`).forEach(file => {
            logger.info(`Found file: ${file}`);
            if (file.endsWith(`${this.filename}.json`)) {
                msgFile = file; }
        });
        if (msgFile === "") {
            logger.error("Failed to read message file in resources/templates/messages directory. Using Defaults.");
            return "placeholder";
        } else {
            logger.info(`Using message override file: ${msgFile}`);
            return `resources/templates/messages/${msgFile}`;
        }
    }

    constructor(overrideFileName: string) {
        if (overrideFileName === "") {
            logger.error("Override file name cannot be blank");
        } else {
            MessageLoader.filename = overrideFileName;
        }
    }
}

MessageLoader.initialize();
