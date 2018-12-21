import {SlackMessage} from "@atomist/slack-messages";
import {QMColours} from "../QMColour";
import {ParameterDisplayType} from "./RecursiveParameterRequestCommand";

export class ParameterStatusDisplay {

    private readonly setParameters: { [key: string]: string };
    private readonly paramOrder: string[];

    constructor() {
        this.setParameters = {};
        this.paramOrder = [];
    }

    public setParam(paramName: string, paramValue: string) {
        this.setParameters[paramName] = paramValue;
        this.paramOrder.push(paramName);
    }

    public getDisplayMessage(commandName: string, displayRequested: ParameterDisplayType): SlackMessage {
        const attachments = [];
        if (displayRequested !== ParameterDisplayType.hide) {
            let textDisplay = `Preparing command *${commandName}*: \n`;

            for (const parameter of this.paramOrder) {
                textDisplay += `*${parameter}*\n${this.setParameters[parameter]}\n\n`;
            }
            attachments.push(
                {
                    text: textDisplay,
                    color: QMColours.stdGreenyMcAppleStroodle.hex,
                    fallback: "",
                    mrkdwn_in: ["text"],
                },
            );
        }

        return {
            attachments,
        };
    }
}
