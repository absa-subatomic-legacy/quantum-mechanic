import {logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {CommandIntent} from "../../commands/CommandIntent";
import {LinkExistingApplication} from "../../commands/packages/LinkExistingApplication";
import {LinkExistingLibrary} from "../../commands/packages/LinkExistingLibrary";
import {QMColours} from "../../util/QMColour";
import {DocumentationUrlBuilder} from "../documentation/DocumentationUrlBuilder";
import {MessageLoader} from "../MessageLoader";

export class ProjectMessages {
    private messageLoader = new MessageLoader("ProjectMessages");

    public packageUsageMessage(projectName: string): SlackMessage {

        this.messageLoader.loadMessage();
        const msg: SlackMessage = {
            text: `
Since you have Subatomic project environments ready, you can now add packages.
A package is either an application or a library, click the button below to create an application now.`,
            attachments: [{
                fallback: "Create or link existing package",
                footer: `For more information, please read the ${DocumentationUrlBuilder.generalCommandReference(CommandIntent.ConfigureBasicPackage)}`,
                color: QMColours.stdGreenyMcAppleStroodle.hex,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Link existing application"},
                        new LinkExistingApplication(),
                        {
                            projectName,
                        }),
                    buttonForCommand(
                        {text: "Link existing library"},
                        new LinkExistingLibrary(),
                        {
                            projectName,
                        }),
                ],
            }],
        };
        if (this.messageLoader.validOverride) {
            try {
                msg.text = this.messageLoader.msgObject.packageUsageMessage.text;
            } catch (e) {
                logger.error("Failed to substitute text for packageUsageMessage, Check JSON object:" + e);
            }
        }
        return msg;
    }
}
