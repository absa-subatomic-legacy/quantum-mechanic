import {
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {JoinTeamMessages} from "../../messages/team/JoinTeamMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Apply to join an existing team", QMConfig.subatomic.commandPrefix + " apply to team")
@Tags("subatomic", "team")
export class JoinTeam extends BaseQMComand implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUser)
    public slackName: string;

    public joinTeamMessages: JoinTeamMessages = new JoinTeamMessages();

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const teams = await this.getAllTeams();
            logger.info(`Found teams data: ${JSON.stringify(teams)}`);

            // remove teams that he is already a member of - TODO in future

            const result = ctx.messageClient.respond(this.joinTeamMessages.presentMenuForTeamSelection(this.slackName, teams));
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    public async getAllTeams() {
        const teamsQueryResult = await this.gluonService.teams.getAllTeams();

        if (!isSuccessCode(teamsQueryResult.status)) {
            this.failCommand();
            throw new QMError("Team does not exist", this.joinTeamMessages.alertUserThatNoTeamsExist());
        }

        return teamsQueryResult.data._embedded.teamResources;
    }
}
