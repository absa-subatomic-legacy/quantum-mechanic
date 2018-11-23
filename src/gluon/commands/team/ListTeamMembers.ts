import {
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {SlackMessage} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {Extensible} from "../../util/plugins/Extensible";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("List members of a team", QMConfig.subatomic.commandPrefix + " list team members")
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
            const result = await this.gluonService.teams.gluonTeamByName(this.teamName);
            const teamOwners = this.getTeamMemberNames(result.owners);
            const teamMembers = this.getTeamMemberNames(result.members);

            const msg: SlackMessage = {
                text: `Team: *${this.teamName}*`,
                attachments: [
                    {
                        fallback: `Team: *${this.teamName}*`,
                        text: `Team Owners:${teamOwners}`,
                        color: "#00ddff",
                        mrkdwn_in: ["text"],
                    },
                    {
                        fallback: `Team: *${this.teamName}*`,
                        text: `Team Members:${teamMembers}`,
                        color: "#c000ff",
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
            teamMemberNames.push(` @${member.slack.screenName}`);
        }

        return teamMemberNames;
    }
}
