import {
    CommandHandler,
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {TeamSlackChannelService} from "../../services/team/TeamSlackChannelService";
import {setGluonTeamName} from "../../util/recursiveparam/ParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";

@CommandHandler("Link existing team channel", QMConfig.subatomic.commandPrefix + " link team channel")
@Tags("subatomic", "slack", "channel", "team")
export class LinkExistingTeamSlackChannel extends RecursiveParameterRequestCommand {

    public static RecursiveKeys = {
        teamName: "TEAM_NAME",
    };

    @MappedParameter(MappedParameters.SlackUserName)
    public slackScreenName: string;

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @RecursiveParameter({
        recursiveKey: LinkExistingTeamSlackChannel.RecursiveKeys.teamName,
        selectionMessage: "Please select the team you would like to link the slack channel to",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: true,
    })
    public teamChannel: string;

    constructor(private gluonService = new GluonService(),
                private teamSlackChannelService = new TeamSlackChannelService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        return await this.teamSlackChannelService.linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.teamChannel, "link-team-channel", false);
    }

    protected configureParameterSetters() {
        this.addRecursiveSetter(LinkExistingTeamSlackChannel.RecursiveKeys.teamName, setGluonTeamName);
    }
}
