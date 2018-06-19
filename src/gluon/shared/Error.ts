import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {SlackMessage} from "@atomist/slack-messages";

export function logErrorAndReturnSuccess(method, error): HandlerResult {
    logger.info(`Don't display the error - ${method} already handles it.`);
    logger.error(error);
    return success();
}

export async function handleQMError(messageClient: QMMessageClient, error: any) {
    logger.error("Trying to handle QM error.");
    if (error instanceof Error) {
        logger.error("Error is not of QMError type. Letting error bubble up.");
        throw error;
    } else if (error instanceof QMError) {
        logger.error(`Error is of QMError type. Error: ${error.message}`);

        return await messageClient.send(`❗${error.message}`);
    }
    logger.error("Unknown error type. Rethrowing error.");
    throw new Error(error);
}

export class QMError extends Error {
    // Nothing special
}

export interface QMMessageClient {
    send(message: (string|SlackMessage)): Promise<HandlerResult>;
}

export class ResponderMessageClient implements QMMessageClient {
    private ctx: HandlerContext;

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
    }

    public async send(message: (string|SlackMessage)): Promise<HandlerResult> {
        return await this.ctx.messageClient.respond(message);
    }
}

export class UserMessageClient implements QMMessageClient {
    private ctx: HandlerContext;
    private readonly users: string[];

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
        this.users = [];
    }

    public addDestination(user: string) {
        this.users.push(user);
    }

    public async send(message: (string|SlackMessage)): Promise<HandlerResult> {
        return await this.ctx.messageClient.addressUsers(message, this.users);
    }
}

export class ChannelMessageClient implements QMMessageClient {
    private ctx: HandlerContext;
    private readonly channels: string[];

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
        this.channels = [];
    }

    public addDestination(channel: string) {
        this.channels.push(channel);
    }

    public async send(message: (string|SlackMessage)): Promise<HandlerResult> {
        return await this.ctx.messageClient.addressChannels(message, this.channels);
    }
}
