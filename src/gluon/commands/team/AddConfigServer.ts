import {
    addressEvent,
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {ConfigServerRequestedEvent} from "../../events/team/ConfigServerRequested";
import {GluonService} from "../../services/gluon/GluonService";
import {QMParamValidation} from "../../util/QMParamValidation";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {GluonToEvent} from "../../util/transform/GluonToEvent";
import {QMMemberBase} from "../../util/transform/types/gluon/Member";
import {QMTeam} from "../../util/transform/types/gluon/Team";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Add a new Subatomic Config Server", atomistIntent(CommandIntent.AddConfigServer))
@Tags("subatomic", "team")
export class AddConfigServer extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    @Parameter({
        description: "Remote Git repository SSH",
        pattern: QMParamValidation.getPattern("AddConfigServer", "gitUri", "^ssh:\\/\\/.*$"),
    })
    public gitUri: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            return await this.addConfigServer(
                ctx,
                this.teamName,
                this.slackUserId,
                this.gitUri,
            );
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async addConfigServer(ctx: HandlerContext,
                                  gluonTeamName: string,
                                  actionedBySlackUserId: string,
                                  gitUri: string): Promise<any> {
        const team: QMTeam = await this.gluonService.teams.getTeamByName(gluonTeamName);
        const actionedBy: QMMemberBase = await this.gluonService.members.gluonMemberFromSlackUserId(actionedBySlackUserId);

        const requestConfigServerEvent: ConfigServerRequestedEvent = {
            team: GluonToEvent.team(team),
            actionedBy: GluonToEvent.member(actionedBy),
            configRepositoryGitURI: gitUri,
        };

        await ctx.messageClient.send(requestConfigServerEvent, addressEvent("ConfigServerRequestedEvent"));
        await ctx.messageClient.respond("Requesting Config Server...");
    }

}
