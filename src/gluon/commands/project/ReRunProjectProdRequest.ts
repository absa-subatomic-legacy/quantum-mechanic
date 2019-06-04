import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {
    addressEvent,
    addressSlackChannelsFromContext,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError} from "../../util/shared/Error";

@CommandHandler("Re-run a failed project production request")
export class ReRunProjectProdRequest extends BaseQMComand {

    @Parameter({
        required: true,
        description: "correlation id of the message that invoked this command",
    })
    public correlationId: string;

    @Parameter({
        required: true,
        description: "project prod request id",
    })
    public projectProdRequestId: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("ReRunning Project Prod Request");

        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `Ru-running Project Prod Request`,
            }, destination, {id: this.correlationId});

            const projectProdRequestEvent = {
                projectProdRequestId: this.projectProdRequestId,
            };

            const result = await ctx.messageClient.send(projectProdRequestEvent, addressEvent("ProjectProductionEnvironmentsRequestClosedEvent"));
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
