import {
    addressEvent,
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {ConfigServerRequestedEvent} from "../../events/team/ConfigServerRequested";
import {GluonService} from "../../services/gluon/GluonService";
import {QMMemberBase} from "../../util/member/Members";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";
import {GluonToEvent} from "../../util/transform/GluonToEvent";
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
        pattern: /^ssh:\/\/.*$/,
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
                this.screenName,
                this.gitUri,
            );
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async addConfigServer(ctx: HandlerContext,
                                  gluonTeamName: string,
                                  actionedByScreenName: string,
                                  gitUri: string): Promise<any> {
        const team: QMTeam = await this.gluonService.teams.gluonTeamByName(gluonTeamName);
        const actionedBy: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(actionedByScreenName);

        const requestConfigServerEvent: ConfigServerRequestedEvent = {
            team: GluonToEvent.team(team),
            actionedBy: GluonToEvent.member(actionedBy),
            configRepositoryGitURI: gitUri,
        };

        await ctx.messageClient.send(requestConfigServerEvent, addressEvent("ConfigServerRequestedEvent"));
        await ctx.messageClient.respond("Requesting Config Server...");
    }

}
