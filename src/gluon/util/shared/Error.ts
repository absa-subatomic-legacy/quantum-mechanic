import {HandlerResult, logger, success} from "@atomist/automation-client";
import {SlackMessage, url} from "@atomist/slack-messages";
import _ = require("lodash");
import * as util from "util";
import {QMConfig} from "../../../config/QMConfig";
import {SimpleQMMessageClient} from "../../../context/QMMessageClient";

export function logErrorAndReturnSuccess(method, error): HandlerResult {
    logger.info(`Don't display the error - ${method} already handles it.`);
    logger.error(error);
    return success();
}

export async function handleQMError(messageClient: SimpleQMMessageClient, error) {
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
    }
    logger.error("Unknown error type. Rethrowing error.");
    throw new Error(error);
}

export class QMError extends Error {
    constructor(message: string, protected slackMessage: SlackMessage | string = null, public errorType: QMErrorType = QMErrorType.generic, private linkToFAQ: boolean = true) {
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

        if (this.linkToFAQ) {
            displayMessage = displayMessage + ` Consulting the ${url(`${QMConfig.subatomic.docs.baseUrl}/FAQ`, "FAQ")} may be useful.`;
        }
        let result: SlackMessage = {
            text: displayMessage,
        };
        if (isFullSlackMessage) {
            result = _.cloneDeep(this.slackMessage) as SlackMessage;
            result.text = displayMessage;
        }

        return result;
    }
}

export enum QMErrorType {
    generic = "generic",
    conflict = "conflict",
}

export class GitError extends Error {
    constructor(message: string, private defaultMessage: string = "Failed to interpret Git exception. Please alert your system admin to check the logs and correct the issue accordingly.") {
        super(message);
    }

    public getSlackMessage() {
        let errorFriendlyMessage = this.defaultMessage;
        logger.debug(`Attempting to resolve slack message for GitError`);

        const identificationFunctions = [
            this.identifyCannotPushToMasterError,
            this.identifyNonExistantOrMissingPermissionsError,
            this.identifyUninitializedRepository,
        ];

        for (const identificationFunction of identificationFunctions) {
            const identification = identificationFunction(this.message);
            if (identification.identified) {
                errorFriendlyMessage = identification.friendlyErrorMessage;
                break;
            }
        }

        return {
            text: `❗${errorFriendlyMessage}`,
        };
    }

    private identifyCannotPushToMasterError(message: string): { identified: boolean, friendlyErrorMessage?: string } {
        const regex: RegExp = /-{5,}\s+remote:([\s\S]*?)remote:\s-+/;
        const match = regex.exec(message);
        if (match == null) {
            return {identified: false};
        }
        let errorFriendlyMessage = match[1];
        errorFriendlyMessage = errorFriendlyMessage.replace("remote: ", "");
        logger.debug(`Derived error message from Error for GitError: ${errorFriendlyMessage}`);
        return {identified: true, friendlyErrorMessage: errorFriendlyMessage};
    }

    private identifyNonExistantOrMissingPermissionsError(message: string): { identified: boolean, friendlyErrorMessage?: string } {
        const regex: RegExp = /The\s*requested\s*repository\s*does\s*not\s*exist,\s*or\s*you\s*do\s*not\s*have\s*permission\s*to\s*access\s*it/;
        const match = regex.exec(message);
        if (match == null) {
            return {identified: false};
        }
        const errorFriendlyMessage = "The target repository either does not exist, or Subatomic does not have permissions to access it.";
        logger.debug(`Derived error message from Error for GitError: ${errorFriendlyMessage}`);
        return {identified: true, friendlyErrorMessage: errorFriendlyMessage};
    }

    private identifyUninitializedRepository(message: string): { identified: boolean, friendlyErrorMessage?: string } {
        const regex: RegExp = /--unshallow\s*on\s*a\s*complete\s*repository\s*does\s*not\s*make\s*sense/;
        const match = regex.exec(message);
        if (match == null) {
            return {identified: false};
        }
        const errorFriendlyMessage = "The target repository has not been initialised. An initial commit is required before Subatomic can operate on the repository.";
        logger.debug(`Derived error message from Error for GitError: ${errorFriendlyMessage}`);
        return {identified: true, friendlyErrorMessage: errorFriendlyMessage};
    }
}
