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
import {GluonService} from "../../services/gluon/GluonService";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Re-run a failed team cloud migration")
export class ReRunMigrateTeamCloud extends BaseQMComand {

    @Parameter({
        required: true,
        displayable: false,
    })
    public correlationId: string;

    @Parameter({
        required: true,
        displayable: false,
    })
    public teamCloudMigrationEvent: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Re-running Team Migration");

        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `Re-running Team Migration`,
            }, destination, {id: this.correlationId});

            // const projectProdRequestEvent = {
            //     projectProdRequestId: this.projectProdRequestId,
            // };

            // const result = await ctx.messageClient.send(projectProdRequestEvent, addressEvent("ProjectProductionEnvironmentsRequestClosedEvent"));
            const result = await ctx.messageClient.send(JSON.parse(this.teamCloudMigrationEvent), addressEvent("TeamOpenShiftCloudMigratedEvent"));
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
