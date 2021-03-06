import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError, QMError} from "../../util/shared/Error";

@CommandHandler("Request membership to a team")
export class CreateMembershipRequestToTeam extends BaseQMComand implements HandleCommand<HandlerResult> {

    @Parameter({
        description: "Gluon team id to create a membership request to.",
        displayable: false,
    })
    public teamId: string;

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Request to join team: ${this.teamId}`);
        try {
            const memberDetails = await this.gluonService.members.gluonMemberFromSlackUserId(this.slackUserId);

            await this.createMembershipRequest(memberDetails);

            const result = await ctx.messageClient.respond("Your request to join then team has been sent.");
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
