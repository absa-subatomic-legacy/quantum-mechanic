import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {MessageOptions} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import _ = require("lodash");
import * as util from "util";
import {QMConfig} from "../../../config/QMConfig";
import {OCCommandResult} from "../../../openshift/base/OCCommandResult";

export function logErrorAndReturnSuccess(method, error): HandlerResult {
    logger.info(`Don't display the error - ${method} already handles it.`);
    logger.error(error);
    return success();
}

export async function handleQMError(messageClient: QMMessageClient, error) {
    logger.error("Trying to handle QM error.");

    if (error && "code" in error && error.code === "ECONNREFUSED") {
        logger.error(`Error code suggests and external service is down.\nError: ${util.inspect(error)}`);
        return await messageClient.send(`❗Unexpected failure. An external service dependency appears to be down.`);
    } else if (error instanceof GitError) {
        logger.error(`Error is of GitError type. Error: ${error.message}`);
        return await messageClient.send(error.getSlackMessage());
    } else if (error instanceof QMError) {
        logger.error(`Error is of QMError type. Error: ${error.message}`);
        return await messageClient.send(error.getSlackMessage());
    } else if (error instanceof Error) {
        logger.error(`Error is of default Error type.\nError: ${util.inspect(error)}`);
        return await messageClient.send(`❗Unhandled exception occurred. Please alert your system admin to check the logs and correct the issue accordingly.`);
    } else if (error instanceof OCResultError) {
        logger.error(`Error is of OCResultError type. Error: ${error.message}`);
        return await messageClient.send(`${error.getSlackMessage()}`);
    } else if (error instanceof OCCommandResult) {
        logger.error(`Error is of OCCommandResult type (unhandled OCCommand failure).
        Command: ${error.command}
        Error: ${error.error}`);

        return await messageClient.send(`❗An Openshift command failed to run successfully. Please alert your system admin to check the logs and correct the issue accordingly.`);
    }
    logger.error("Unknown error type. Rethrowing error.");
    throw new Error(error);
}

export class QMError extends Error {
    constructor(message: string, protected slackMessage: SlackMessage | string = null, public errorType: QMErrorType = QMErrorType.generic) {
        super(message);
    }

    public getSlackMessage() {
        // Concatenate the FAQ help message to all QMErrors. This requires some special logic
        // to do correctly for cases where the message does not end with a punctuation mark,
        // and for the different data types the message instance may be.
        let displayMessage = ``;
        let isFullSlackMessage = false;
        if (this.slackMessage === null) {
            displayMessage = `❗${this.message}`;
        } else if (typeof this.slackMessage === "string") {
            displayMessage = `❗${this.slackMessage}`;
        } else {
            isFullSlackMessage = true;
            displayMessage = this.slackMessage.text;
        }

        // Check whether the message ends with a punctation mark or special character.
        if (displayMessage.charAt(displayMessage.length - 1).match(/[.,\/#!$%^&*;:{}=\-_`~()]/g) === null) {
            displayMessage = displayMessage + ".";
        }

        displayMessage = displayMessage + ` Consulting the ${url(`${QMConfig.subatomic.docs.baseUrl}/FAQ`, "FAQ")} may be useful.`;
        let result: SlackMessage = {
            text: displayMessage,
        };
        if (isFullSlackMessage) {
            result = _.cloneDeep(this.slackMessage) as SlackMessage;
            result.text = displayMessage;
        }

        return {
            text: displayMessage,
        };
    }
}

export enum QMErrorType {
    generic = "generic",
    conflict = "conflict",
}

export class OCResultError extends QMError {
    constructor(private ocCommandResult: OCCommandResult, message: string, slackMessage: SlackMessage | string = message) {
        super(message, slackMessage);
        this.message = `${message}
        Command: ${ocCommandResult.command}
        Error: ${ocCommandResult.error}`;
    }
}

export class GitError extends Error {
    constructor(message: string) {
        super(message);
    }

    public getSlackMessage() {
        let errorFriendlyMessage = "Failed to interpret Git exception. Please alert your system admin to check the logs and correct the issue accordingly.";
        logger.debug(`Attempting to resolve slack message for GitError`);

        const regex: RegExp = /-{5,}\s{1,}remote:([\s\S]*?)remote:\s-{1,}/;
        const match = regex.exec(this.message);
        if (match !== null) {
            errorFriendlyMessage = match[1];
            errorFriendlyMessage = errorFriendlyMessage.replace("remote: ", "");
            logger.debug(`Derived error message from Error for GitError: ${errorFriendlyMessage}`);
        }
        return {
            text: `❗${errorFriendlyMessage}`,
        };
    }
}

export interface QMMessageClient {
    send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult>;
}

export class ResponderMessageClient implements QMMessageClient {
    private ctx: HandlerContext;

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
    }

    public async send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult> {
        return await this.ctx.messageClient.respond(message, options);
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
        return this;
    }

    public async send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult> {
        return await this.ctx.messageClient.addressUsers(message, this.users, options);
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
        return this;
    }

    public async send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult> {
        return await this.ctx.messageClient.addressChannels(message, this.channels, options);
    }
}
