import {logger} from "@atomist/automation-client";
import {JsonLoader} from "../util/resources/JsonLoader";

export class MessageLoader {

    public msgObject: {[key: string]: {text: string}};
    public validOverride: boolean;
    private readonly filename: string;
    constructor(overrideFileName: string) {
        if (overrideFileName === "") {
            logger.error("Message Override file name cannot be blank");
        } else {
            this.filename = overrideFileName;
        }
    }
    public loadMessage() {
        try {
            this.msgObject = new JsonLoader().readFileContents(`resources/templates/messages/${this.filename}Override.json`);
            logger.info("Successfully loaded override messages from file");
            this.validOverride = true;

        } catch (e) {
            logger.warn(`Failed to load override file for ${this.filename}`);
            logger.error(e);
            this.validOverride = false;
        }
    }
}
