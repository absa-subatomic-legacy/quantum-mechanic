import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {PackageDefinition} from "../../util/packages/packagedef/PackageDefinition";
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
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {createMenuAttachment} from "../../util/shared/GenericMenu";
import {ConfigurePackage} from "./ConfigurePackage";

const PACKAGE_DEFINITION_EXTENSION = ".json";
const PACKAGE_DEFINITION_FOLDER = "resources/package-definitions/";

@CommandHandler("Configure an existing application/library using a predefined template", QMConfig.subatomic.commandPrefix + " configure package")
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
        description: "Restore sources for .Net, if your package is not .Net simply enter `Jerry`. Otherwise enter the urls separated by a space",
    })
    public restoreSources: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected initialise() {
        this.displayResultMenu = ParameterDisplayType.showInitial;
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const jsonLoader = new JsonLoader();
            const definition: PackageDefinition = jsonLoader.readTemplatizedFileContents(this.getPathFromDefinitionName(this.packageDefinition), QMConfig.publicConfig());
            const unprocessedPackageDefinition: PackageDefinition = jsonLoader.readFileContents(this.getPathFromDefinitionName(this.packageDefinition));
            definition.deploymentConfig = unprocessedPackageDefinition.deploymentConfig;
            const environmentVariablePrompt = await this.getEnvironmentVariablePrompt(definition);
            await ctx.messageClient.respond(environmentVariablePrompt.message, {id: this.messagePresentationCorrelationId});
            if (environmentVariablePrompt.complete) {
                const result = await this.callPackageConfiguration(ctx, definition);
                this.succeedCommand();
                return result;
            }
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async callPackageConfiguration(ctx: HandlerContext, definition: PackageDefinition): Promise<HandlerResult> {
        const configurePackage = new ConfigurePackage();
        configurePackage.screenName = this.screenName;
        configurePackage.teamChannel = this.teamChannel;
        configurePackage.openshiftTemplate = definition.openshiftTemplate || "Default";
        configurePackage.jenkinsfileName = definition.jenkinsfile;
        configurePackage.imageName = definition.buildConfig.imageStream;
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

    private async getEnvironmentVariablePrompt(definition: PackageDefinition) {
        // Test to see if all expected environment variables are set
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

                        const variablePromptAttachment = createMenuAttachment(
                            menuOptions,
                            this,
                            `Please set the ${requiredVariable.description} environment variable.`,
                            `Please set the ${requiredVariable.description} environment variable.`,
                            "Select a value",
                            "environmentVariableValueHolder",
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

    private getPathFromDefinitionName(definitionName: string): string {
        return `${PACKAGE_DEFINITION_FOLDER}${this.packageType.toLowerCase()}/${definitionName}${PACKAGE_DEFINITION_EXTENSION}`;
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
        messagePrompt: createMenuAttachment(packageDefinitionOptions.map(packageDefinition => {
                return {
                    value: packageDefinition,
                    text: packageDefinition,
                };
            }),
            commandHandler,
            selectionMessage,
            selectionMessage,
            "Select a package definition",
            "packageDefinition"),
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
