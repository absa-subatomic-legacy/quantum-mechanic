import {
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {TeamSlackChannelService} from "../../services/team/TeamSlackChannelService";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Link existing team channel", QMConfig.subatomic.commandPrefix + " link team channel")
@Tags("subatomic", "slack", "channel", "team")
export class LinkExistingTeamSlackChannel extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select the team you would like to link the slack channel to",
    })
    public teamName: string;

    @Parameter({
        required: true,
        displayName: "Team Slack Channel",
        description: "The slack channel to link to your team (excluding the #)",
        pattern: /^(?!<#).*/,
        validInput: "a slack channel name without the #",
    })
    public newTeamChannel: string;

    constructor(public gluonService = new GluonService(),
                private teamSlackChannelService = new TeamSlackChannelService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            const result = await this.teamSlackChannelService.linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.newTeamChannel, false);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
