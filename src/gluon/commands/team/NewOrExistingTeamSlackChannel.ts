import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
} from "@atomist/automation-client";
import {TeamSlackChannelMessages} from "../../messages/team/TeamSlackChannelMessages";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";

@CommandHandler("Check whether to create a new team channel or use an existing channel")
export class NewOrUseTeamSlackChannel extends BaseQMComand implements HandleCommand {

    @Parameter({
        description: "team name",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: false,
    })

    public teamSlackChannelMessages = new TeamSlackChannelMessages();

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        return await ctx.messageClient.respond(this.teamSlackChannelMessages.createNewOrUseExistingSlackChannel(this.teamChannel, this.teamName));
    }
}
