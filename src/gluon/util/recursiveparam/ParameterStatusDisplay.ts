import {SlackMessage} from "@atomist/slack-messages";
import {QMColours} from "../QMColour";
import {ParameterDisplayType} from "./RecursiveParameterRequestCommand";

export class ParameterStatusDisplay {

    private readonly setParameters: { [key: string]: { value: string, displayable: boolean } };
    private readonly paramOrder: string[];

    constructor() {
        this.setParameters = {};
        this.paramOrder = [];
    }

    public setParam(paramName: string, paramValue: string, displayable: boolean) {
        this.setParameters[paramName] = {value: paramValue, displayable};
        this.paramOrder.push(paramName);
    }

    public getDisplayMessage(commandName: string, displayRequested: ParameterDisplayType): SlackMessage {
        const attachments = [];
        if (displayRequested !== ParameterDisplayType.hide) {
            let textDisplay = `Preparing command *${commandName}*: \n`;

            for (const parameter of this.paramOrder) {
                if (this.setParameters[parameter].displayable) {
                    textDisplay += `*${parameter}*\n${this.setParameters[parameter].value}\n\n`;
                }
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
