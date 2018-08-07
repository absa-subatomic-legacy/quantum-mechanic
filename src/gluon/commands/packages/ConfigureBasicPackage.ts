import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
} from "@atomist/automation-client";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {QMTemplate} from "../../../template/QMTemplate";
import {GluonService} from "../../services/gluon/GluonService";
import {menuForApplications} from "../../util/packages/Applications";
import {PackageDefinition} from "../../util/packages/PackageDefinition";
import {menuForProjects} from "../../util/project/Project";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {createMenu} from "../../util/shared/GenericMenu";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/shared/RecursiveParameterRequestCommand";
import {menuForTeams} from "../../util/team/Teams";
import {ConfigurePackage} from "./ConfigurePackage";

@CommandHandler("Configure an existing application/library using a predefined template", QMConfig.subatomic.commandPrefix + " configure package")
export class ConfigureBasicPackage extends RecursiveParameterRequestCommand {
    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @RecursiveParameter({
        description: "team name",
        required: false,
        displayable: false,
    })
    public teamName: string;

    @RecursiveParameter({
        description: "application name",
        required: false,
        displayable: false,
    })
    public applicationName: string;

    @RecursiveParameter({
        description: "project name",
        required: false,
        displayable: false,
    })
    public projectName: string;

    @RecursiveParameter({
        description: "package type",
    })
    public packageType: string;

    @RecursiveParameter({
        description: "package definition file",
    })
    public packageDefinition: string;

    private readonly PACKAGE_DEFINITION_EXTENSION = ".json";
    private readonly PACKAGE_DEFINITION_FOLDER = "resources/package-definitions/";

    constructor(private gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            return await this.callPackageConfiguration(ctx);
        } catch (error) {
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    protected async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await this.gluonService.teams.gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
                return await this.handle(ctx);
            } catch (error) {
                const teams = await this.gluonService.teams.gluonTeamsWhoSlackScreenNameBelongsTo(this.screenName);
                return await menuForTeams(
                    ctx,
                    teams,
                    this,
                    "Please select a team associated with the project you wish to configure the package for");
            }

        }
        if (_.isEmpty(this.projectName)) {
            const projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(this.teamName);
            return await menuForProjects(ctx, projects, this, "Please select the owning project of the package you wish to configure");
        }
        if (_.isEmpty(this.applicationName)) {
            const applications = await this.gluonService.applications.gluonApplicationsLinkedToGluonProject(this.projectName);
            return await menuForApplications(ctx, applications, this, "Please select the package you wish to configure");
        }
        if (_.isEmpty(this.packageType)) {
            const application = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName, false);
            this.packageType = application.applicationType;
            return await this.handle(ctx);
        }
        if (_.isEmpty(this.packageDefinition)) {
            return await this.requestPackageDefinitionFile(ctx);
        }
    }

    private async requestPackageDefinitionFile(ctx: HandlerContext): Promise<HandlerResult> {
        const packageDefinitionOptions: string [] = this.readPackageDefinitions(this.packageType);
        return await createMenu(ctx, packageDefinitionOptions.map(packageDefinition => {
                return {
                    value: packageDefinition,
                    text: packageDefinition,
                };
            }),
            this,
            "Please select a package definition to use for your project",
            "Select a package definition",
            "packageDefinition");
    }

    private readPackageDefinitions(packageType: string) {
        const fs = require("fs");
        const packageDefinitionOptions: string [] = [];
        logger.info(`Searching folder: ${this.PACKAGE_DEFINITION_FOLDER}${packageType.toLowerCase()}/`);
        fs.readdirSync(`${this.PACKAGE_DEFINITION_FOLDER}${packageType.toLowerCase()}/`).forEach(file => {
            logger.info(`Found file: ${file}`);
            if (file.endsWith(this.PACKAGE_DEFINITION_EXTENSION)) {
                packageDefinitionOptions.push(this.getNameFromDefinitionPath(file));
            }
        });
        return packageDefinitionOptions;
    }

    private async callPackageConfiguration(ctx: HandlerContext): Promise<HandlerResult> {
        const configTemplate: QMTemplate = new QMTemplate(this.getPathFromDefinitionName(this.packageDefinition));
        const definition: PackageDefinition = JSON.parse(configTemplate.build(QMConfig.publicConfig()));

        const configurePackage = new ConfigurePackage();
        configurePackage.screenName = this.screenName;
        configurePackage.teamChannel = this.teamChannel;
        configurePackage.openshiftTemplate = definition.openshiftTemplate || "Default";
        configurePackage.jenkinsfileName = definition.jenkinsfile;
        configurePackage.baseS2IImage = definition.buildConfig.imageStream;
        if (definition.buildConfig.envVariables != null) {
            configurePackage.buildEnvironmentVariables = definition.buildConfig.envVariables;
        }
        configurePackage.applicationName = this.applicationName;
        configurePackage.teamName = this.teamName;
        configurePackage.projectName = this.projectName;

        return await configurePackage.handle(ctx);
    }

    private getNameFromDefinitionPath(definitionPath: string): string {
        const definitionSlashSplit = definitionPath.split("/");
        let name = definitionSlashSplit[definitionSlashSplit.length - 1];
        // Remove file extension
        name = name.substring(0, definitionPath.length - this.PACKAGE_DEFINITION_EXTENSION.length);
        return name;
    }

    private getPathFromDefinitionName(definitionName: string): string {
        return `${this.PACKAGE_DEFINITION_FOLDER}${this.packageType}/${definitionName}${this.PACKAGE_DEFINITION_EXTENSION}`;
    }
}
