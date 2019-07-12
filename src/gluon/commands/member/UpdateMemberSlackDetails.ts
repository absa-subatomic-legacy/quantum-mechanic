import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {
    CommandHandler,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client/lib/decorators";
import {AtomistQMContext, QMContext} from "../../../context/QMContext";
import {
    ResponderMessageClient,
    SimpleQMMessageClient,
} from "../../../context/QMMessageClient";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError, QMError} from "../../util/shared/Error";
import {QMMemberBase} from "../../util/transform/types/gluon/Member";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Update Members Slack details", atomistIntent(CommandIntent.UpdateSlackDetails))
@Tags("subatomic", "slack", "member")
export class UpdateMemberSlackDetails extends BaseQMComand {

    @MappedParameter(MappedParameters.SlackUser)
    public userId: string;

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            logger.info("Updating User's Slack Details in Gluon");
            return await this.handleQMCommand(new AtomistQMContext(ctx));
        } catch (error) {
            this.failCommand();
            return await this.handleError(new ResponderMessageClient(ctx), error);
        }
    }

    public async handleQMCommand(ctx: QMContext): Promise<HandlerResult> {
        let memberDetails: QMMemberBase;
        try {
            memberDetails = await this.gluonService.members.gluonMemberFromSlackUserId(this.userId);
        } catch (error) {
            throw new QMError("Cannot find member details in Subatomic. Please ensure that you are already onboarded");
        }
        const updateMemberDetailsResult = await this.gluonService.members.updateMemberSlackDetails(memberDetails.memberId, {
            userId: this.userId,
            screenName: this.screenName,
        });

        if (!isSuccessCode(updateMemberDetailsResult.status) && updateMemberDetailsResult.status !== 409) {
            throw new QMError("Failed to update the users Slack details in Subatomic.");
        }

        await ctx.messageClient.respond("Successfully updated your Slack details in Subatomic.");

        this.succeedCommand();
        return success();
    }

    private async handleError(messageClient: SimpleQMMessageClient, error) {
        return await handleQMError(messageClient, error);
    }
}
