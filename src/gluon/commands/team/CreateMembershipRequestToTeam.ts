import {
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {getScreenName, loadScreenNameByUserId} from "../../util/member/Members";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {BaseQMHandler} from "../../util/shared/BaseQMHandler";
import {handleQMError, QMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Request membership to a team")
export class CreateMembershipRequestToTeam extends BaseQMComand implements HandleCommand<HandlerResult> {

    @Parameter({
        description: "Gluon team id to create a membership request to.",
        displayable: false,

    })
    public teamId: string;

    @Parameter({
        description: "Slack name of the member to add.",
    })
    public slackName: string;

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Request to join team: ${this.teamId}`);
        try {

            const screenName = getScreenName(this.slackName);

            const chatId = await loadScreenNameByUserId(ctx, screenName);

            const memberDetails = await this.gluonService.members.gluonMemberFromScreenName(chatId);

            await this.createMembershipRequest(memberDetails);

            const result =  await ctx.messageClient.respond("Your request to join then team has been sent.");
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async createMembershipRequest(newMember) {
        const updateTeamResult = await this.gluonService.teams.createMembershipRequest(this.teamId,
            {
                membershipRequests: [
                    {
                        requestedBy: {
                            memberId: newMember.memberId,
                        },
                    }],
            });

        if (!isSuccessCode(updateTeamResult.status)) {
            throw new QMError(`❗Failed to add member to the team. Server side failure.`);
        }
    }
}
