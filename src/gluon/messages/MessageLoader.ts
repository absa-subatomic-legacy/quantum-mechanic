import {logger} from "@atomist/automation-client";
import {JsonLoader} from "../util/resources/JsonLoader";
const fs = require("fs");

export class MessageLoader {

    public msgObject: {[key: string]: {text: string}};
    public validOverride: boolean;
    private readonly filename: string = "";
    private readonly path: string;
    constructor(overrideFileName: string) {
        if (overrideFileName === "") {
            logger.error("Message Override file name cannot be blank");
        } else {
            this.path = `resources/templates/messages/${this.filename}Override.json`
            if (fs.existsSync(this.path)) {
                logger.info("Message Override file found");
                this.filename = overrideFileName;
            }
        }
    }
    public loadMessage() {
        this.validOverride = false;
        if (this.filename !== "") {
            logger.info(`Message override detected for ${this.filename}`);
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
