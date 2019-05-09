import {logger} from "@atomist/automation-client";
import {JsonLoader} from "../util/resources/JsonLoader";
const fs = require("fs");

export class MessageLoader {
    public msgObject: { [key: string]: { text: string } };
    public validOverride: boolean;
    private path: string;
    private readonly filename: string;
    constructor(overrideFileName: string) {
        logger.info(`Message Override instantiated for ${overrideFileName}`);
        if (overrideFileName === "") {
            logger.error("Message Override file name cannot be blank");
        } else {
            this.filename = overrideFileName;
        }
    }
    public loadMessage() {
        logger.info("Message Override loading message");
        this.validOverride = false;
        this.path = `resources/templates/messages/${this.filename}Override.json`;
        if (this.filename !== "" && fs.existsSync(this.path)) {
            logger.info(`Message Override file detected for ${this.filename}`);
            try {
                this.msgObject = new JsonLoader().readFileContents(this.path);
                logger.info("Successfully loaded override messages from file");
                this.validOverride = true;
            } catch (e) {
                logger.error(`Failed to load override file for ${this.filename}`);
                logger.error(e);
            }
        }
    }
}
