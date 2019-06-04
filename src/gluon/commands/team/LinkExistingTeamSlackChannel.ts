import {
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {TeamSlackChannelService} from "../../services/team/TeamSlackChannelService";
import {QMMemberBase} from "../../util/member/Members";
import {QMParamValidation} from "../../util/QMParamValidation";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Link existing team channel", atomistIntent(CommandIntent.LinkExistingTeamSlackChannel))
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
        pattern: QMParamValidation.getPattern("LinkExistingTeamSlackChannel", "newTeamChannel", "^(?!<#).*"),
        validInput: "a slack channel name without the #",
    })
    public newTeamChannel: string;

    constructor(public gluonService = new GluonService(),
                private teamSlackChannelService = new TeamSlackChannelService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            const member: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);
            const result = await this.teamSlackChannelService.linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.newTeamChannel, member.memberId, false);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
