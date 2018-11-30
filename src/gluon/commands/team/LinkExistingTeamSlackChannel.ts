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
    GluonTeamNameSetter,
    setGluonTeamName,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Link existing team channel", QMConfig.subatomic.commandPrefix + " link team channel")
@Tags("subatomic", "slack", "channel", "team")
export class LinkExistingTeamSlackChannel extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    private static RecursiveKeys = {
        teamName: "TEAM_NAME",
    };

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @RecursiveParameter({
        recursiveKey: LinkExistingTeamSlackChannel.RecursiveKeys.teamName,
        selectionMessage: "Please select the team you would like to link the slack channel to",
    })

    @Parameter({
        description: "team channel name",
        required: true,
    })

    public teamName: string;

    constructor(public gluonService = new GluonService(),
                private teamSlackChannelService = new TeamSlackChannelService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            const result = await this.teamSlackChannelService.linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.teamChannel, "link-team-channel", false);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    protected configureParameterSetters() {
        this.addRecursiveSetter(LinkExistingTeamSlackChannel.RecursiveKeys.teamName, setGluonTeamName);
    }
}
