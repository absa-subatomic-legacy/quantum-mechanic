import {logger} from "@atomist/automation-client";
import {SlackMessage} from "@atomist/slack-messages";
import fs = require("fs");
import stripJsonComments = require("strip-json-comments");

export class MessageLoader {

    public msgObject: {[key: string]: {text: string}};
    public validOverride: boolean;
    private readonly filename: string;
    constructor(overrideFileName: string) {
        if (overrideFileName === "") {
            logger.error("Override file name cannot be blank");
        } else {
            this.filename = overrideFileName;
            this.loadMessage();
        }
    }

    private loadMessage() {
        fs.readFile(`resources/templates/messages/${this.filename}Override.json`, (err, data) => {
            if (err) {
                logger.info(`Failed to load override file for ${this.filename}`);
                this.validOverride = false;
            }
            const msgRaw = stripJsonComments(data);
            const msgObject = JSON.parse(msgRaw);
            this.validOverride = true;
            this.msgObject = msgObject;
        });
    }
}
