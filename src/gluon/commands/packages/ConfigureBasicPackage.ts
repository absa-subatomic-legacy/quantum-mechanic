import {
    buttonForCommand,
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {
    ChannelMessageClient,
    ResponderMessageClient,
    SimpleQMMessageClient,
} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {
    ImageStreamDefinition,
    PackageDefinition,
} from "../../util/packages/packagedef/PackageDefinition";
import {SetterLoader} from "../../util/packages/packagedef/SetterLoader";
import {QMColours} from "../../util/QMColour";
import {
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    ParameterDisplayType,
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {RecursiveSetterResult} from "../../util/recursiveparam/RecursiveSetterResult";
import {JsonLoader} from "../../util/resources/JsonLoader";
import {handleQMError} from "../../util/shared/Error";
import {createSortedMenuAttachment} from "../../util/shared/GenericMenu";
import {atomistIntent, CommandIntent} from "../CommandIntent";
import {ConfigurePackage} from "./ConfigurePackage";

const PACKAGE_DEFINITION_EXTENSION = ".json";
const PACKAGE_DEFINITION_FOLDER = "resources/package-definitions/";

@CommandHandler("Configure an existing application/library using a predefined template", atomistIntent(CommandIntent.ConfigureBasicPackage))
@Tags("subatomic", "package")
export class ConfigureBasicPackage extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @GluonApplicationNameParam({
        callOrder: 2,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @RecursiveParameter({
        callOrder: 3,
        setter: setPackageType,
    })
    public packageType: string;

    @RecursiveParameter({
        callOrder: 4,
        selectionMessage: "Please select a package definition to use for your project",
        setter: setPackageDefinitionFile,
    })
    public packageDefinition: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public environmentVariableValueHolder: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public currentEnvironmentVariablesJSON: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public currentManualDynamicParamsJSON: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected initialise() {
        this.displayResultMenu = ParameterDisplayType.showInitial;
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const messageClient: SimpleQMMessageClient = new ChannelMessageClient(ctx).addDestination(this.teamChannel);
            const jsonLoader = new JsonLoader();
            const definition: PackageDefinition = jsonLoader.readTemplatizedFileContents(this.getPathFromDefinitionName(this.packageDefinition), QMConfig.publicConfig());
            const unprocessedPackageDefinition: PackageDefinition = jsonLoader.readFileContents(this.getPathFromDefinitionName(this.packageDefinition));
            definition.deploymentConfig = unprocessedPackageDefinition.deploymentConfig;

            // First get any manually typed environment variables
            const manualEnvironmentVariableCollection = this.requestManualDynamicEnvironmentVariables(definition);
            if (!manualEnvironmentVariableCollection.complete) {
                return await messageClient.send(manualEnvironmentVariableCollection.message, {id: this.messagePresentationCorrelationId});
            }

            // If all manual dynamic variables are set, request all menu based dynamic variables
            const environmentVariablePrompt = await this.requestMenuBasedDynamicEnvironmentVariables(definition);
            await messageClient.send(environmentVariablePrompt.message, {id: this.messagePresentationCorrelationId});
            if (environmentVariablePrompt.complete) {
                // Once all additional environment variables prompts are complete, configure the package
                const result = await this.callPackageConfiguration(ctx, definition);
                this.succeedCommand();
                return result;
            }
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private requestManualDynamicEnvironmentVariables(definition: PackageDefinition) {
        // This will prompt the user to enter any required environment variables
        // with no setter defined in the package definition
        let setParams = {};
        if (this.currentManualDynamicParamsJSON !== undefined) {
            setParams = JSON.parse(this.currentManualDynamicParamsJSON);
        }
        if (definition.requiredEnvironmentVariables !== undefined) {
            for (const envVar of definition.requiredEnvironmentVariables) {
                if (envVar.setter === undefined) {
                    if (!setParams.hasOwnProperty(envVar.name)) {
                        const paramSetter = new DynamicParameterSetter(this);
                        paramSetter.currentManualDynamicParametersJSON = this.currentManualDynamicParamsJSON;
                        paramSetter.paramName = envVar.name;
                        const displayMessage = this.getDisplayMessage();

                        displayMessage.attachments.push({
                            text: `You need to enter a custom build environment variable *${envVar.name}* - ${envVar.description}:`,
                            fallback: "",
                            actions: [
                                buttonForCommand(
                                    {
                                        text: "Enter value",
                                    },
                                    paramSetter),
                            ],
                            color: QMColours.stdShySkyBlue.hex,
                        });
                        return {complete: false, message: displayMessage};
                    }
                }
            }
        }
        this.currentEnvironmentVariablesJSON = JSON.stringify(setParams);
        return {complete: true};
    }

    private async requestMenuBasedDynamicEnvironmentVariables(definition: PackageDefinition) {
        // This will prompt the user for any environment variables that have defined setters
        // in the package defintion
        if (definition.requiredEnvironmentVariables !== undefined) {
            let currentEnvVarValues: { [key: string]: string } = {};
            if (!_.isEmpty(this.currentEnvironmentVariablesJSON)) {
                currentEnvVarValues = JSON.parse(this.currentEnvironmentVariablesJSON);
            }

            for (const requiredVariable of definition.requiredEnvironmentVariables) {
                if (!currentEnvVarValues.hasOwnProperty(requiredVariable.name)) {
                    if (this.environmentVariableValueHolder !== undefined) {
                        currentEnvVarValues[requiredVariable.name] = this.environmentVariableValueHolder;
                        this.environmentVariableValueHolder = undefined;
                        this.currentEnvironmentVariablesJSON = JSON.stringify(currentEnvVarValues);
                    } else {
                        this.currentEnvironmentVariablesJSON = JSON.stringify(currentEnvVarValues);
                        const optionsSetterFunction = await new SetterLoader(requiredVariable.setter).getLoader();
                        const menuOptions = await optionsSetterFunction(this);
                        const displayMessage = this.getDisplayMessage();

                        const variablePromptAttachment = createSortedMenuAttachment(
                            menuOptions,
                            this, {
                                text: `Select a value for the *${requiredVariable.name}* environment variable. ${requiredVariable.description}`,
                                fallback: `Select a value for the *${requiredVariable.name}* environment variable. ${requiredVariable.description}`,
                                selectionMessage: "Select a value",
                                resultVariableName: "environmentVariableValueHolder",
                            },
                        );

                        variablePromptAttachment.color = QMColours.stdShySkyBlue.hex;
                        displayMessage.attachments.push(variablePromptAttachment);
                        return {complete: false, message: displayMessage};
                    }
                }
            }
        }
        return {complete: true, message: this.getDisplayMessage()};
    }

    private async callPackageConfiguration(ctx: HandlerContext, definition: PackageDefinition): Promise<HandlerResult> {
        const configurePackage = new ConfigurePackage();
        const imageStream: ImageStreamDefinition = definition.buildConfig.imageStream;
        configurePackage.screenName = this.screenName;
        configurePackage.slackUserId = this.slackUserId;
        configurePackage.teamChannel = this.teamChannel;
        configurePackage.openshiftTemplate = definition.openshiftTemplate || "Default";
        configurePackage.jenkinsfileName = definition.jenkinsfile;
        configurePackage.imageName = imageStream.imageName;
        configurePackage.imageTag = imageStream.imageTag;
        if (!_.isEmpty(definition.buildConfig.envVariables)) {
            configurePackage.buildEnvironmentVariables = definition.buildConfig.envVariables;
        } else {
            configurePackage.buildEnvironmentVariables = {};
        }
        if (!_.isEmpty(definition.deploymentConfig)) {
            configurePackage.deploymentEnvironmentVariables = definition.deploymentConfig.envVariables;
        } else {
            configurePackage.deploymentEnvironmentVariables = {};
        }

        let currentEnvVarValues: { [key: string]: string } = {};
        if (!_.isEmpty(this.currentEnvironmentVariablesJSON)) {
            currentEnvVarValues = JSON.parse(this.currentEnvironmentVariablesJSON);
        }
        for (const variableName of Object.keys(currentEnvVarValues)) {
            configurePackage.buildEnvironmentVariables[variableName] = currentEnvVarValues[variableName];
        }
        configurePackage.applicationName = this.applicationName;
        configurePackage.teamName = this.teamName;
        configurePackage.projectName = this.projectName;
        configurePackage.messagePresentationCorrelationId = this.messagePresentationCorrelationId;
        configurePackage.displayResultMenu = ParameterDisplayType.hide;

        return await configurePackage.handle(ctx);
    }

    private getPathFromDefinitionName(definitionName: string): string {
        return `${PACKAGE_DEFINITION_FOLDER}${this.packageType.toLowerCase()}/${definitionName}${PACKAGE_DEFINITION_EXTENSION}`;
    }
}

@CommandHandler("Sets a parameter dynamically")
@Tags("subatomic")
export class DynamicParameterSetter implements HandleCommand<HandlerResult> {
    /**
     * This class is used to prompt users to enter additional dynamically defined parameters
     * Essentially the class captures the parameter and inserts it into a json objects stored as
     * a string which can then be parsed and extracted by the actual parent command. This
     * work around is due to how the atomist parameter types are restricted to only primitive values
     */

    @Parameter({
        displayable: false,
        required: false,
    })
    public currentManualDynamicParametersJSON: string;

    @Parameter({
        displayName: "parameter name",
    })
    public paramName: string;

    @Parameter({
        description: "the parameter value",
    })
    public paramValue: string;

    @Parameter({
        displayable: false,
        required: false,
    })
    public currentCommandJSON: string;

    constructor(originatingCommand?) {

        const currentCommand = {};
        if (originatingCommand !== undefined) {
            const paramNames = this.getParamNames(originatingCommand);
            const params = this.findParamValues(originatingCommand, paramNames);
            if (params !== undefined) {
                for (const param of Object.keys(params)) {
                    const name = param;
                    currentCommand[name] = params[name];
                }
            }
        }
        this.currentCommandJSON = JSON.stringify(currentCommand);
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        let currentDynamicParameters = {};
        if (this.currentManualDynamicParametersJSON !== undefined) {
            currentDynamicParameters = JSON.parse(this.currentManualDynamicParametersJSON);
        }
        currentDynamicParameters[this.paramName] = this.paramValue;
        const command = new ConfigureBasicPackage();

        const currentCommandParameters = JSON.parse(this.currentCommandJSON);

        this.setParams(command, currentCommandParameters);

        command.currentManualDynamicParamsJSON = JSON.stringify(currentDynamicParameters);
        return await command.handle(ctx);
    }

    private findParamValues(originalInstance, params) {
        // Extract all param values into a key value store of name:value pairs
        const currentParams: { [key: string]: any } = {};
        for (const param of params) {
            currentParams[param] = originalInstance[param];
        }
        return currentParams;
    }

    private getParamNames(instance, currentParams = []) {
        // Recursively extract all the atomist parameter names from the object
        // This will also pull all the mappedParameter names
        if (instance.__parameters !== undefined) {
            for (const param of instance.__parameters) {
                if (currentParams.indexOf(param.name) === -1) {
                    currentParams.push(param.name);
                }
            }
        }
        if (instance.__mappedParameters !== undefined) {
            for (const param of instance.__mappedParameters) {
                if (currentParams.indexOf(param.name) === -1) {
                    currentParams.push(param.name);
                }
            }
        }
        if (instance.__proto__.constructor.name !== "Object") {
            this.getParamNames(instance.__proto__, currentParams);
        }
        return currentParams;
    }

    private setParams(instance, params) {
        // Set all the param values on the given instance of an object
        for (const key of Object.keys(params)) {
            instance[key] = params[key];
        }
    }

}

async function setPackageType(ctx: HandlerContext, commandHandler: ConfigureBasicPackage): Promise<RecursiveSetterResult> {
    const application = await commandHandler.gluonService.applications.gluonApplicationForNameAndProjectName(commandHandler.applicationName, commandHandler.projectName, false);
    commandHandler.packageType = application.applicationType;
    return {
        setterSuccess: true,
    };
}

async function setPackageDefinitionFile(ctx: HandlerContext, commandHandler: ConfigureBasicPackage, selectionMessage: string): Promise<RecursiveSetterResult> {
    const packageDefinitionOptions: string [] = readPackageDefinitions(commandHandler.packageType);
    return {
        setterSuccess: false,
        messagePrompt: createSortedMenuAttachment(packageDefinitionOptions.map(packageDefinition => {
                return {
                    value: packageDefinition,
                    text: packageDefinition,
                };
            }),
            commandHandler,
            {
                text: selectionMessage,
                fallback: selectionMessage,
                selectionMessage: "Select a package definition",
                resultVariableName: "packageDefinition",
            }),
    };
}

function readPackageDefinitions(packageType: string) {
    const fs = require("fs");
    const packageDefinitionOptions: string [] = [];
    logger.info(`Searching folder: ${PACKAGE_DEFINITION_FOLDER}${packageType.toLowerCase()}/`);
    fs.readdirSync(`${PACKAGE_DEFINITION_FOLDER}${packageType.toLowerCase()}/`).forEach(file => {
        logger.info(`Found file: ${file}`);
        if (file.endsWith(PACKAGE_DEFINITION_EXTENSION)) {
            packageDefinitionOptions.push(getNameFromDefinitionPath(file));
        }
    });
    return packageDefinitionOptions;
}

function getNameFromDefinitionPath(definitionPath: string): string {
    const definitionSlashSplit = definitionPath.split("/");
    let name = definitionSlashSplit[definitionSlashSplit.length - 1];
    // Remove file extension
    name = name.substring(0, definitionPath.length - PACKAGE_DEFINITION_EXTENSION.length);
    return name;
}
