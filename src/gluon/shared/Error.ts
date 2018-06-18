import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {Destination} from "@atomist/automation-client/spi/message/MessageClient";

export function logErrorAndReturnSuccess(method, error): HandlerResult {
    logger.info(`Don't display the error - ${method} already handles it.`);
    logger.error(error);
    return success();
}

export async function handleQMError(ctx: HandlerContext, destinations: Destination|Destination[], error: any) {
    logger.error("Trying to handle QM error.");
    if (error instanceof Error) {
        logger.error("Error is not of QMError type. Letting error bubble up.");
        throw error;
    } else if (error instanceof QMError) {
        logger.error(`Error is of QMError type. Error: ${error.message}`);

        return await ctx.messageClient.send(`❗${error.message}`, destinations);
    }
    logger.error("Unknown error type. Rethrowing error.");
    throw new Error(error);
}

export class QMError extends Error {
    // Nothing special
}
