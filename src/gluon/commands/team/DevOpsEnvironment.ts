import {
    HandlerContext,
    logger,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {AtomistQMContext, QMContext} from "../../../context/QMContext";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Check whether to create a new OpenShift DevOps environment or use an existing one", atomistIntent(CommandIntent.NewDevOpsEnvironment))
@Tags("subatomic", "slack", "team", "devops")
export class NewDevOpsEnvironment extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team you would like to create a DevOps environment for",
    })
    public teamName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public runQMCommand(ctx: QMContext) {
        return this.requestDevOpsEnvironment(
            ctx,
            this.screenName,
            this.teamName,
            this.teamChannel,
        );
    }

    protected runCommand(ctx: HandlerContext) {
        return this.runQMCommand(new AtomistQMContext(ctx));
    }

    private async requestDevOpsEnvironment(ctx: QMContext,
                                           screenName: string,
                                           teamName: string,
                                           teamChannel: string): Promise<any> {

        await ctx.messageClient.sendToChannels(`Requesting DevOps environment for *${teamName}* team.`, teamChannel);

        const member = await this.gluonService.members.gluonMemberFromScreenName(screenName);

        const team = await this.gluonService.teams.gluonTeamByName(teamName);
        logger.info("Requesting DevOps environment for team: " + teamName);

        const teamUpdateResult = await this.requestDevOpsEnvironmentThroughGluon(team.teamId, member.memberId);

        if (!isSuccessCode(teamUpdateResult.status)) {
            this.failCommand();
            logger.error(`Unable to request ${teamName} devops environment. Error: ${teamUpdateResult}`);
            return await ctx.messageClient.respond(`❗Unable to request devops environment for ${teamName}.`);
        }

        this.succeedCommand();
        return await success();
    }

    private async requestDevOpsEnvironmentThroughGluon(teamId: string, memberId: string) {
        return await this.gluonService.teams.requestDevOpsEnvironment(teamId, memberId);
    }

}
