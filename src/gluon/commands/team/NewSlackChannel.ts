import {
    HandlerContext,
    HandlerResult,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import * as _ from "lodash";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {TeamSlackChannelService} from "../../services/team/TeamSlackChannelService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError} from "../../util/shared/Error";
import {QMMemberBase} from "../../util/transform/types/gluon/Member";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Create team channel", atomistIntent(CommandIntent.NewTeamSlackChannel))
@Tags("subatomic", "slack", "channel", "team")
export class NewTeamSlackChannel extends BaseQMComand implements HandleCommand {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @Parameter({
        description: "team name",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: false,
        displayable: false,
    })
    public newTeamChannel: string;

    constructor(public gluonService = new GluonService(),
                private teamSlackChannelService = new TeamSlackChannelService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            this.newTeamChannel = _.isEmpty(this.newTeamChannel) ? this.teamName : this.newTeamChannel;
            const member: QMMemberBase = await this.gluonService.members.gluonMemberFromSlackUserId(this.slackUserId);
            const result = await this.teamSlackChannelService.linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.newTeamChannel, member.memberId, true);
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
