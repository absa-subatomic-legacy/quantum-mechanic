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
import {
    addressEvent,
    addressSlackChannelsFromContext,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Re-run a failed project production request")
export class ReRunProjectProdRequest implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

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

            return await ctx.messageClient.send(projectProdRequestEvent, addressEvent("ProjectProductionEnvironmentsRequestClosedEvent"));
        } catch (error) {
            return await this.handleError(ctx, error);
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
