import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {addressEvent} from "@atomist/automation-client/spi/message/MessageClient";
import {addressSlackChannels} from "@atomist/automation-client/spi/message/MessageClient";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Re-run a failed project production request")
@Tags("subatomic", "openshiftProd", "project")
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
            await ctx.messageClient.send({
                text: `Ru-running Project Prod Request`,
            }, addressSlackChannels(QMConfig.teamId, this.teamChannel), {id: this.correlationId});

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
