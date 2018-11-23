import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
} from "@atomist/automation-client";
import {
    BaseParameter,
    declareParameter,
} from "@atomist/automation-client/lib/internal/metadata/decoratorSupport";
import _ = require("lodash");
import uuid = require("uuid");
import {BaseQMComand} from "../shared/BaseQMCommand";
import {handleQMError, QMError, ResponderMessageClient} from "../shared/Error";
import {ParameterStatusDisplay} from "./ParameterStatusDisplay";
import {RecursiveSetterResult} from "./RecursiveSetterResult";

export abstract class RecursiveParameterRequestCommand extends BaseQMComand {

    @Parameter({
        required: false,
        displayable: false,
    })
    public messagePresentationCorrelationId: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public displayResultMenu: ParameterDisplayType;

    private recursiveParameterListNew: RecursiveParameterMapping[];

    private parameterStatusDisplay: ParameterStatusDisplay;

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.messagePresentationCorrelationId)) {
            this.messagePresentationCorrelationId = uuid.v4();
        }

        if (_.isEmpty(this.displayResultMenu)) {
            this.displayResultMenu = ParameterDisplayType.show;
        }

        this.updateParameterStatusDisplayMessage();
        if (!this.recursiveParametersAreSet()) {
            try {
                return await this.requestNextUnsetParameter(ctx);
            } catch (error) {
                return await this.handleRequestNextParameterError(ctx, error);
            }
        }

        const displayMessage = this.parameterStatusDisplay.getDisplayMessage(this.getIntent(), this.displayResultMenu);

        await ctx.messageClient.respond(displayMessage, {id: this.messagePresentationCorrelationId});

        return await this.runCommand(ctx);
    }

    public addRecursiveParameterProperty(parameterDetails: RecursiveParameterDetails, propertyKey: string) {
        this.recursiveParameterListNew = this.recursiveParameterListNew !== undefined ? this.recursiveParameterListNew : [];
        for (let i = 0; i < this.recursiveParameterListNew.length; i++) {
            if (parameterDetails.callOrder < this.recursiveParameterListNew[i].callOrder) {
                this.recursiveParameterListNew.splice(i, 0, {
                    propertyName: propertyKey,
                    parameterSetter: parameterDetails.setter,
                    selectionMessage: parameterDetails.selectionMessage,
                    forceSet: parameterDetails.forceSet,
                    callOrder: parameterDetails.callOrder,
                });
                break;
            }
        }
    }

    protected async requestNextUnsetParameter(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Requesting next unset recursive parameter.`);
        const result: Promise<HandlerResult> = this.setNextParameter(ctx) || null;

        if (result !== null) {
            return await result;
        }

        throw new QMError("Recursive parameters could not be set correctly. This is an implementation fault. Please raise an issue.");
    }

    protected abstract runCommand(ctx: HandlerContext): Promise<HandlerResult>;

    private async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        const dynamicClassInstance: any = this;
        for (const parameter of this.recursiveParameterListNew) {
            const propertyKey = parameter.propertyName;
            const propertyValue = dynamicClassInstance[propertyKey];
            if (_.isEmpty(propertyValue)) {
                logger.info(`Setting parameter ${propertyKey}.`);
                const result = await parameter.parameterSetter(ctx, this, parameter.selectionMessage);
                if (result.setterSuccess) {
                    return await this.handle(ctx);
                } else {
                    const displayMessage = this.parameterStatusDisplay.getDisplayMessage(this.getIntent(), this.displayResultMenu);
                    result.messagePrompt.color = "#00a5ff";
                    displayMessage.attachments.push(result.messagePrompt);
                    return await ctx.messageClient.respond(displayMessage, {id: this.messagePresentationCorrelationId});
                }
            }
        }
    }

    private recursiveParametersAreSet(): boolean {
        let parametersAreSet = true;
        const dynamicClassInstance: any = this;
        for (const parameter of this.recursiveParameterListNew) {

            const propertyKey = parameter.propertyName;
            const propertyValue = dynamicClassInstance[propertyKey];

            logger.debug(`Recursive Param details:\nProperty: ${propertyKey}\nForceSet: ${parameter.forceSet}\nValue: ${dynamicClassInstance[propertyKey]}`);

            if (parameter.forceSet &&
                _.isEmpty(propertyValue)) {
                logger.info(`Recursive parameter ${propertyKey} not set.`);
                parametersAreSet = false;
                break;
            }
        }
        return parametersAreSet;
    }

    private updateParameterStatusDisplayMessage() {
        this.parameterStatusDisplay = new ParameterStatusDisplay();
        const dynamicClassInstance: any = this;
        for (const parameter of this.recursiveParameterListNew) {

            const propertyKey = parameter.propertyName;
            const propertyValue = dynamicClassInstance[propertyKey];

            if (!(_.isEmpty(propertyValue))) {
                this.parameterStatusDisplay.setParam(propertyKey, propertyValue);
            }
        }
    }

    private getIntent(): string {
        const dynamicClassInstance: any = this;
        const intentValue = dynamicClassInstance.__intent;
        if (!_.isEmpty(intentValue)) {
            return intentValue;
        }

        return "Unknown Command";
    }

    private async handleRequestNextParameterError(ctx: HandlerContext, error) {
        const messageClient = new ResponderMessageClient(ctx);
        return await handleQMError(messageClient, error);
    }
}

export function RecursiveParameter(details: RecursiveParameterDetails) {
    return (target: any, propertyKey: string) => {
        const recursiveParameters: any = {...details};
        if (target instanceof RecursiveParameterRequestCommand) {
            if (recursiveParameters.forceSet === undefined) {
                recursiveParameters.forceSet = true;
            }
            recursiveParameters.required = false;
            recursiveParameters.displayable = false;
            target.addRecursiveParameterProperty(recursiveParameters, propertyKey);
        }
        declareParameter(target, propertyKey, recursiveParameters);
    };
}

export interface RecursiveParameterDetails extends BaseParameter {
    setter?: (ctx: HandlerContext, commandHandler, selectionMessage: string) => Promise<RecursiveSetterResult>;
    forceSet?: boolean;
    selectionMessage?: string;
    callOrder: number;
}

interface RecursiveParameterMapping {
    propertyName: string;
    parameterSetter: (ctx: HandlerContext, commandHandler, selectionMessage: string) => Promise<RecursiveSetterResult>;
    selectionMessage: string;
    callOrder: number;
    forceSet: boolean;
}

export enum ParameterDisplayType {
    show = "show",
    hide = "hide",
}
