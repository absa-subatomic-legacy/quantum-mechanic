import {
    HandlerContext,
    HandlerResult,
    logger,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {QMTemplate} from "../../../template/QMTemplate";
import {GluonService} from "../../services/gluon/GluonService";
import {PackageDefinition} from "../../util/packages/PackageDefinition";
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

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const result = await this.callPackageConfiguration(ctx);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async callPackageConfiguration(ctx: HandlerContext): Promise<HandlerResult> {
        const configTemplate: QMTemplate = new QMTemplate(this.getPathFromDefinitionName(this.packageDefinition));
        const definition: PackageDefinition = JSON.parse(configTemplate.build(QMConfig.publicConfig()));

        const configurePackage = new ConfigurePackage();
        configurePackage.screenName = this.screenName;
        configurePackage.teamChannel = this.teamChannel;
        configurePackage.openshiftTemplate = definition.openshiftTemplate || "Default";
        configurePackage.jenkinsfileName = definition.jenkinsfile;
        configurePackage.imageName = definition.buildConfig.imageStream;
        if (definition.buildConfig.envVariables != null) {
            configurePackage.buildEnvironmentVariables = definition.buildConfig.envVariables;
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
