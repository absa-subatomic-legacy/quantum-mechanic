import {SlackMessage} from "@atomist/slack-messages";

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

    public getDisplayMessage(commandName: string): SlackMessage {
        let textDisplay = `Preparing command *${commandName}*: \n`;

        for (const parameter of this.paramOrder) {
            textDisplay += `*${parameter}*: ${this.setParameters[parameter]}\n`;
        }

        return {
            text: textDisplay,
            attachments: [],
        };
    }
}
