import {
    HandlerContext,
    HandlerResult,
    Parameter,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {TeamSlackChannelMessages} from "../../messages/team/TeamSlackChannelMessages";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

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
    public teamChannel: string;

    public teamSlackChannelMessages = new TeamSlackChannelMessages();

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const result =  await ctx.messageClient.respond(this.teamSlackChannelMessages.createNewOrUseExistingSlackChannel(this.teamChannel, this.teamName));
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        const messageClient = new ResponderMessageClient(ctx);
        return await handleQMError(messageClient, error);
    }
}
