import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {LinkExistingTeamSlackChannel} from "./LinkExistingTeamSlackChannel";
import {NewTeamSlackChannel} from "./NewSlackChannel";

@CommandHandler("Check whether to create a new team channel or use an existing channel")
@Tags("subatomic", "slack", "channel", "team")
export class NewOrUseTeamSlackChannel implements HandleCommand {

    @Parameter({
        description: "team name",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: false,
    })
    public teamChannel: string;

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        const text: string = `\
Would you like to create a new team channel called *${this.teamChannel}* or \
if you have an existing channel you'd like to use for team wide messages, \
rather use that instead?\
        `;
        const msg: SlackMessage = {
            text,
            attachments: [{
                fallback: `Do you want to create a new team channel (${this.teamChannel}) or link an existing one?`,
                footer: `For more information, please read the ${this.docs()}`,
                actions: [
                    buttonForCommand(
                        {text: `Create channel ${this.teamChannel}`},
                        new NewTeamSlackChannel(),
                        {
                            teamId: ctx.teamId,
                            teamName: this.teamName,
                            teamChannel: this.teamChannel,
                        }),
                    buttonForCommand(
                        {text: "Use an existing channel"},
                        new LinkExistingTeamSlackChannel(),
                        {
                            teamId: ctx.teamId,
                            teamName: this.teamName,
                        }),
                ],
            }],
        };
        return await ctx.messageClient.respond(msg);
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/user-guide/create-a-team#associate-a-slack-channel`,
            "documentation")}`;
    }
}
