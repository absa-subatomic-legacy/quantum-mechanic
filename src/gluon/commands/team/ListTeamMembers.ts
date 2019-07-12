import {
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {SlackMessage} from "@atomist/slack-messages";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {Extensible} from "../../util/plugins/Extensible";
import {QMColours} from "../../util/QMColour";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("List members of a team", atomistIntent(CommandIntent.ListTeamMembers))
@Tags("subatomic", "slack", "channel", "member", "team")
export class ListTeamMembers extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @GluonTeamNameParam({
        callOrder: 0.,
        selectionMessage: "Please select the team you would like to list the members of",
    })
    public teamName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    @Extensible("Team.ListTeamMembers")
    protected async runCommand(ctx: HandlerContext) {
        try {
            const result = await this.gluonService.teams.getTeamByName(this.teamName);
            const teamOwners = this.getTeamMemberNames(result.owners);
            const teamMembers = this.getTeamMemberNames(result.members);

            const msg: SlackMessage = {
                text: `Team: *${this.teamName}*`,
                attachments: [
                    {
                        fallback: `Team: *${this.teamName}*`,
                        text: `Team Owners:${teamOwners}`,
                        color: QMColours.stdTurquoiseSurprise.hex,
                        mrkdwn_in: ["text"],
                    },
                    {
                        fallback: `Team: *${this.teamName}*`,
                        text: `Team Members:${teamMembers}`,
                        color: QMColours.stdPurplePeopleEater.hex,
                        mrkdwn_in: ["text"],
                    }],
            };

            this.succeedCommand();
            return await ctx.messageClient.respond(msg);
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private getTeamMemberNames(teamDetails: any): string[] {
        const teamMemberNames = [];

        for (const member of teamDetails) {
            teamMemberNames.push(` <@${member.slack.userId}>`);
        }

        return teamMemberNames;
    }
}
