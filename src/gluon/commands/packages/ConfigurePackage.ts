import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
} from "@atomist/automation-client";
import {BitBucketServerRepoRef} from "@atomist/automation-client/operations/common/BitBucketServerRepoRef";
import {GitCommandGitProject} from "@atomist/automation-client/project/git/GitCommandGitProject";
import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {addressEvent} from "@atomist/automation-client/spi/message/MessageClient";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    ApplicationType,
    menuForApplications,
} from "../../util/packages/Applications";
import {
    getProjectDevOpsId,
    getProjectId,
    menuForProjects,
} from "../../util/project/Project";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {createMenu} from "../../util/shared/GenericMenu";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/shared/RecursiveParameterRequestCommand";
import {menuForTeams} from "../../util/team/Teams";
import {GluonToEvent} from "../../util/transform/GluonToEvent";

@CommandHandler("Configure an existing application/library", QMConfig.subatomic.commandPrefix + " configure custom package")
export class ConfigurePackage extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @RecursiveParameter({
        description: "application name",
    })
    public applicationName: string;

    @RecursiveParameter({
        description: "project name",
    })
    public projectName: string;

    @RecursiveParameter({
        description: "team name",
    })
    public teamName: string;

    @RecursiveParameter({
        description: "openshift template",
    })
    public openshiftTemplate: string;

    @RecursiveParameter({
        description: "base jenkinsfile",
    })
    public jenkinsfileName: string;

    @Parameter({
        description: "Base image for s2i build",
    })
    public baseS2IImage: string;

    public buildEnvironmentVariables: { [key: string]: string } = {};

    private readonly JENKINSFILE_EXTENSION = ".groovy";
    private readonly JENKINSFILE_FOLDER = "resources/templates/jenkins/jenkinsfile-repo/";
    private readonly JENKINSFILE_EXISTS = "JENKINS_FILE_EXISTS";

    constructor(private gluonService = new GluonService(),
                private jenkinsService = new JenkinsService(),
                private ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            await ctx.messageClient.addressChannels({
                text: "🚀 Your package is being configured...",
            }, this.teamChannel);
            return await this.configurePackage(ctx);
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
        if (_.isEmpty(this.openshiftTemplate)) {
            const namespace = `${_.kebabCase(this.teamName).toLowerCase()}-devops`;
            const templatesResult = await this.ocService.getSubatomicAppTemplates(namespace);
            const templates = JSON.parse(templatesResult.output).items;
            return await createMenu(ctx, templates.map(template => {
                    return {
                        value: template.metadata.name,
                        text: template.metadata.name,
                    };
                }),
                this,
                "Please select the correct openshift template for your package",
                "Select a template",
                "openshiftTemplate");
        }
        if (_.isEmpty(this.jenkinsfileName)) {
            return await this.requestJenkinsFileParameter(ctx);
        }
    }

    private async requestJenkinsFileParameter(ctx: HandlerContext): Promise<HandlerResult> {

        const project = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);
        const application = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName);
        const username = QMConfig.subatomic.bitbucket.auth.username;
        const password = QMConfig.subatomic.bitbucket.auth.password;
        const gitProject: GitProject = await GitCommandGitProject.cloned({
                username,
                password,
            },
            new BitBucketServerRepoRef(
                QMConfig.subatomic.bitbucket.baseUrl,
                project.bitbucketProject.key,
                application.bitbucketRepository.name));
        try {
            await gitProject.findFile("Jenkinsfile");
            this.jenkinsfileName = this.JENKINSFILE_EXISTS;
            return success();
        } catch (error) {
            return await this.createMenuForJenkinsFileSelection(ctx);
        }
    }

    private async createMenuForJenkinsFileSelection(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Jenkinsfile does not exist. Requesting jenkinsfile selection.");
        const fs = require("fs");
        const jenkinsfileOptions: string [] = [];
        logger.info(`Searching folder: ${this.JENKINSFILE_FOLDER}`);
        fs.readdirSync(this.JENKINSFILE_FOLDER).forEach(file => {
            logger.info(`Found file: ${file}`);
            if (file.endsWith(this.JENKINSFILE_EXTENSION)) {
                jenkinsfileOptions.push(this.getNameFromJenkinsfilePath(file));
            }
        });
        return await createMenu(ctx, jenkinsfileOptions.map(jenkinsfile => {
                return {
                    value: jenkinsfile,
                    text: jenkinsfile,
                };
            }),
            this,
            "Please select the correct jenkinsfile for your package",
            "Select a jenkinsfile",
            "jenkinsfileName");
    }

    private getNameFromJenkinsfilePath(jenkinsfilePath: string): string {
        const jenkinsfileSlashSplit = jenkinsfilePath.split("/");
        let name = jenkinsfileSlashSplit[jenkinsfileSlashSplit.length - 1];
        // Remove file extension
        name = name.substring(0, jenkinsfilePath.length - this.JENKINSFILE_EXTENSION.length);
        return name;
    }

    private async configurePackage(ctx: HandlerContext): Promise<HandlerResult> {
        const project = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const application = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName);

        await this.doConfiguration(
            project.name,
            application.name,
            application.applicationType,
            application.bitbucketRepository.remoteUrl,
            project.owningTeam.name,
        );

        return await ctx.messageClient.send(this.createPackageConfiguredEvent(project, application, project.owningTeam), addressEvent("PackageConfiguredEvent"));
    }

    private createPackageConfiguredEvent(gluonProject, gluonApplication, gluonOwningTeam) {
        return {
            application: GluonToEvent.application(gluonApplication),
            project: GluonToEvent.project(gluonProject),
            bitbucketRepository: GluonToEvent.bitbucketRepository(gluonApplication),
            bitbucketProject: GluonToEvent.bitbucketProject(gluonProject),
            owningTeam: GluonToEvent.team(gluonOwningTeam),
            buildDetails: {
                buildType: "JENKINS",
                jenkinsDetails: {
                    jenkinsFile: this.jenkinsfileName,
                },
            },
        };
    }

    private async createApplicationImageStream(appBuildName: string, teamDevOpsProjectId: string) {
        await this.ocService.createResourceFromDataInNamespace({
            apiVersion: "v1",
            kind: "ImageStream",
            metadata: {
                name: appBuildName,
            },
        }, teamDevOpsProjectId);
    }

    private getBuildConfigData(bitbucketRepoRemoteUrl: string, appBuildName: string, baseS2IImage: string): { [key: string]: any } {
        return {
            apiVersion: "v1",
            kind: "BuildConfig",
            metadata: {
                name: appBuildName,
            },
            spec: {
                resources: {
                    limits: {
                        cpu: "0",
                        memory: "0",
                    },
                },
                source: {
                    type: "Git",
                    git: {
                        // temporary hack because of the NodePort
                        // TODO remove this!
                        uri: `${bitbucketRepoRemoteUrl.replace("7999", "30999")}`,
                        ref: "master",
                    },
                    sourceSecret: {
                        name: "bitbucket-ssh",
                    },
                },
                strategy: {
                    sourceStrategy: {
                        from: {
                            kind: "ImageStreamTag",
                            name: baseS2IImage,
                        },
                        env: [],
                    },
                },
                output: {
                    to: {
                        kind: "ImageStreamTag",
                        name: `${appBuildName}:latest`,
                    },
                },
            },
        };
    }

    private async createApplicationBuildConfig(bitbucketRepoRemoteUrl: string, appBuildName: string, baseS2IImage: string, teamDevOpsProjectId: string) {

        logger.info(`Using Git URI: ${bitbucketRepoRemoteUrl}`);
        const buildConfig: { [key: string]: any } = this.getBuildConfigData(bitbucketRepoRemoteUrl, appBuildName, baseS2IImage);

        for (const envVariableName of Object.keys(this.buildEnvironmentVariables)) {
            buildConfig.spec.strategy.sourceStrategy.env.push(
                {
                    name: envVariableName,
                    value: this.buildEnvironmentVariables[envVariableName],
                },
            );
        }

        await this.ocService.createResourceFromDataInNamespace(
            buildConfig,
            teamDevOpsProjectId,
            true);  // TODO clean up this hack - cannot be a boolean (magic)
    }

    private async doConfiguration(projectName: string,
                                  packageName: string,
                                  packageType: string,
                                  bitbucketRepoRemoteUrl: string,
                                  owningTeamName: string,
    ): Promise<HandlerResult> {

        const teamDevOpsProjectId = `${_.kebabCase(owningTeamName).toLowerCase()}-devops`;
        logger.debug(`Using owning team DevOps project: ${teamDevOpsProjectId}`);

        await this.ocService.login();

        if (packageType === ApplicationType.DEPLOYABLE.toString()) {
            const appBuildName = `${_.kebabCase(projectName).toLowerCase()}-${_.kebabCase(packageName).toLowerCase()}`;
            await this.createApplicationImageStream(appBuildName, teamDevOpsProjectId);

            await this.createApplicationBuildConfig(bitbucketRepoRemoteUrl, appBuildName, this.baseS2IImage, teamDevOpsProjectId);

            const project = await this.gluonService.projects.gluonProjectFromProjectName(projectName);
            logger.info(`Trying to find tenant: ${project.owningTenant}`);
            const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);
            logger.info(`Found tenant: ${tenant}`);
            await this.createApplicationOpenshiftResources(tenant.name, project.name, packageName);

        }

        return success();
    }

    private async createApplicationOpenshiftResources(tenantName: string, projectName: string, applicationName: string): Promise<HandlerResult> {

        const environments: string [] = ["dev", "sit", "uat"];

        for (const environment of environments) {
            const projectId = getProjectId(tenantName, projectName, environment);
            const appName = `${_.kebabCase(applicationName).toLowerCase()}`;
            const devOpsProjectId = getProjectDevOpsId(this.teamName);
            logger.info(`Processing app [${appName}] Template for: ${projectId}`);

            const template = await this.ocService.getSubatomicTemplate(this.openshiftTemplate);
            const appBaseTemplate: any = JSON.parse(template.output);
            appBaseTemplate.metadata.namespace = projectId;
            await this.ocService.createResourceFromDataInNamespace(appBaseTemplate, projectId);

            const templateParameters = [
                `APP_NAME=${appName}`,
                `IMAGE_STREAM_PROJECT=${projectId}`,
                `DEVOPS_NAMESPACE=${devOpsProjectId}`,
            ];

            const appProcessedTemplate = await this.ocService.processOpenshiftTemplate(
                this.openshiftTemplate,
                projectId,
                templateParameters,
                true);

            logger.debug(`Processed app [${appName}] Template: ${appProcessedTemplate.output}`);

            try {
                await this.ocService.getDeploymentConfigInNamespace(appName, projectId);
                logger.warn(`App [${appName}] Template has already been processed, deployment exists`);
            } catch (error) {
                await this.ocService.createResourceFromDataInNamespace(
                    JSON.parse(appProcessedTemplate.output),
                    projectId,
                );
            }
        }
        return await success();
    }
}
