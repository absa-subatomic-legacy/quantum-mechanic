import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import {url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Create a new team", QMConfig.subatomic.commandPrefix + " create team")
@Tags("subatomic", "team")
export class CreateTeam extends BaseQMComand implements HandleCommand<HandlerResult> {

    @Parameter({
        description: "team name",
    })
    private name: string;

    @Parameter({
        description: "team description",
    })
    private description: string;

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Creating team for member: ${this.screenName}`);

        try {
            const member = await this.getGluonMemberFromScreenName(this.screenName);

            await this.createTeamInGluon(this.name, this.description, member.memberId);

            const result =  await success();
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async getGluonMemberFromScreenName(screenName: string) {
        return await this.gluonService.members.gluonMemberFromScreenName(screenName);
    }

    private async createTeamInGluon(teamName: string, teamDescription: string, createdBy: string) {
        const teamCreationResult = await this.gluonService.teams.createGluonTeam(teamName, teamDescription, createdBy);

        if (teamCreationResult.status === 409) {
            logger.error(`Failed to create team since the team name is already in use.`);
            throw new QMError(`Failed to create team since the team name is already in use. Please retry using a different team name.`);
        } else if (!isSuccessCode(teamCreationResult.status)) {
            logger.error(`Failed to create the team with name ${teamName}. Error: ${teamCreationResult.status}`);
            throw new QMError("Unable to create team.");
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#onboard-me`,
            "documentation")}`;
    }
}
