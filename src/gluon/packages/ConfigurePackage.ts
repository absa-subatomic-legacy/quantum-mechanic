import {
    CommandHandler,
    failure,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
    SuccessPromise,
} from "@atomist/automation-client";
import {BitBucketServerRepoRef} from "@atomist/automation-client/operations/common/BitBucketServerRepoRef";
import {GitCommandGitProject} from "@atomist/automation-client/project/git/GitCommandGitProject";
import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {url} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {SimpleOption} from "../../openshift/base/options/SimpleOption";
import {OCCommon} from "../../openshift/OCCommon";
import {QMTemplate} from "../../template/QMTemplate";
import {bitbucketRepositoryForSlug} from "../bitbucket/Bitbucket";
import {jenkinsAxios} from "../jenkins/Jenkins";
import {KickOffJenkinsBuild} from "../jenkins/JenkinsBuild";
import {getProjectDevOpsId, getProjectId} from "../project/Project";
import {
    gluonProjectFromProjectName,
    gluonProjectsWhichBelongToGluonTeam,
    menuForProjects,
} from "../project/Projects";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {createMenu} from "../shared/GenericMenu";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../shared/RecursiveParameterRequestCommand";
import {subatomicAppOpenshiftTemplates} from "../shared/SubatomicAppOpenshiftTemplates";
import {gluonTenantFromTenantId} from "../shared/Tenant";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
    menuForTeams,
} from "../team/Teams";
import {
    ApplicationType,
    gluonApplicationForNameAndProjectName,
    gluonApplicationsLinkedToGluonProject,
    menuForApplications,
} from "./Applications";

@CommandHandler("Configure an existing application/library", QMConfig.subatomic.commandPrefix + " configure package")
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

    private readonly JENKINSFILE_EXTENSION = ".groovy";
    private readonly JENKINSFILE_FOLDER = "templates/jenkins/jenkinsfile-repo/";
    private readonly JENKINSFILE_EXISTS = "JENKINS_FILE_EXISTS";

    protected runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        return ctx.messageClient.addressChannels({
            text: "🚀 Your package is being configured...",
        }, this.teamChannel)
            .then(() => {
                    return this.configurePackage(ctx).then(success);
                },
            );
    }

    protected setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            return gluonTeamForSlackTeamChannel(this.teamChannel)
                .then(
                    team => {
                        this.teamName = team.name;
                        return this.setNextParameter(ctx);
                    },
                    () => {
                        return gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName).then(teams => {
                            return menuForTeams(
                                ctx,
                                teams,
                                this,
                                "Please select a team associated with the project you wish to configure the package for");
                        });
                    },
                );
        }
        if (_.isEmpty(this.projectName)) {
            return gluonProjectsWhichBelongToGluonTeam(ctx, this.teamName)
                .then(projects => {
                    return menuForProjects(ctx, projects, this, "Please select the owning project of the package you wish to configure");
                });
        }
        if (_.isEmpty(this.applicationName)) {
            return gluonApplicationsLinkedToGluonProject(ctx, this.projectName).then(applications => {
                return menuForApplications(ctx, applications, this, "Please select the package you wish to configure");
            });
        }
        if (_.isEmpty(this.openshiftTemplate)) {
            const namespace = `${_.kebabCase(this.teamName).toLowerCase()}-devops`;
            return subatomicAppOpenshiftTemplates(namespace)
                .then(templates => {
                    return createMenu(ctx, templates.map(template => {
                            return {
                                value: template.metadata.name,
                                text: template.metadata.name,
                            };
                        }),
                        this,
                        "Please select the correct openshift template for your package",
                        "Select a template",
                        "openshiftTemplate");
                });
        }
        if (_.isEmpty(this.jenkinsfileName)) {
            return this.requestJenkinsFileParameter(ctx);
        }

        return null;
    }

    private requestJenkinsFileParameter(ctx: HandlerContext): Promise<HandlerResult> {
        return gluonProjectFromProjectName(ctx, this.projectName)
            .then(project => {
                return gluonApplicationForNameAndProjectName(ctx, this.applicationName, this.projectName)
                    .then(application => {
                        return bitbucketRepositoryForSlug(project.bitbucketProject.key, application.bitbucketRepository.name)
                            .then(repo => {
                                const username = QMConfig.subatomic.bitbucket.auth.username;
                                const password = QMConfig.subatomic.bitbucket.auth.password;
                                return GitCommandGitProject.cloned({
                                        username,
                                        password,
                                    },
                                    new BitBucketServerRepoRef(
                                        QMConfig.subatomic.bitbucket.baseUrl.replace(/^(https?:|)\/\//, ""),
                                        project.bitbucketProject.key,
                                        application.bitbucketRepository.name))
                                    .then((gitProject: GitProject) => {
                                        return gitProject.findFile("Jenkinsfile")
                                            .then(() => {
                                                logger.info("Jenkinsfile exists.");
                                                this.jenkinsfileName = this.JENKINSFILE_EXISTS;
                                                return this.requestNextUnsetParameter(ctx);
                                            })
                                            .catch(() => {
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
                                                return createMenu(ctx, jenkinsfileOptions.map(jenkinsfile => {
                                                        return {
                                                            value: jenkinsfile,
                                                            text: jenkinsfile,
                                                        };
                                                    }),
                                                    this,
                                                    "Please select the correct jenkinsfile for your package",
                                                    "Select a jenkinsfile",
                                                    "jenkinsfileName");
                                            });
                                    });
                            });
                    });
            });
    }

    private getNameFromJenkinsfilePath(jenkinsfilePath: string): string {
        const jenkinsfileSlashSplit = jenkinsfilePath.split("/");
        let name = jenkinsfileSlashSplit[jenkinsfileSlashSplit.length - 1];
        // Remove file extension
        name = name.substring(0, jenkinsfilePath.length - this.JENKINSFILE_EXTENSION.length);
        return name;
    }

    private getPathFromJenkinsfileName(jenkinsfileName: string): string {
        return this.JENKINSFILE_FOLDER + jenkinsfileName + this.JENKINSFILE_EXTENSION;
    }

    private configurePackage(ctx: HandlerContext): Promise<HandlerResult> {
        return gluonProjectFromProjectName(ctx, this.projectName)
            .then(project => {
                return gluonApplicationForNameAndProjectName(ctx, this.applicationName, this.projectName)
                    .then(application => {
                        return this.doConfiguration(
                            ctx,
                            project.name,
                            project.projectId,
                            application.name,
                            application.applicationType,
                            project.bitbucketProject.key,
                            application.bitbucketRepository.name,
                            application.bitbucketRepository.remoteUrl,
                            project.owningTeam.name,
                            project.teams,
                        );
                    }).catch(error => {
                        return logErrorAndReturnSuccess(gluonApplicationForNameAndProjectName.name, error);
                    });
            }).catch(error => {
                return logErrorAndReturnSuccess(gluonProjectFromProjectName.name, error);
            });
    }

    private addJenkinsfilePromise(bitbucketProjectKey, bitbucketRepoName): Promise<HandlerResult> {
        let jenkinsfilePromise: Promise<any> = Promise.resolve(success());
        if (this.jenkinsfileName !== this.JENKINSFILE_EXISTS) {
            jenkinsfilePromise = bitbucketRepositoryForSlug(bitbucketProjectKey, bitbucketRepoName)
                .then(repo => {
                    const username = QMConfig.subatomic.bitbucket.auth.username;
                    const password = QMConfig.subatomic.bitbucket.auth.password;
                    return GitCommandGitProject.cloned({
                            username,
                            password,
                        },
                        new BitBucketServerRepoRef(
                            QMConfig.subatomic.bitbucket.baseUrl.replace(/^(https?:|)\/\//, ""),
                            bitbucketProjectKey,
                            bitbucketRepoName))
                        .then((project: GitProject) => {
                            return project.findFile("Jenkinsfile")
                                .catch(() => {
                                    logger.info("Jenkinsfile doesnt exist. Adding it!");
                                    const jenkinsTemplate: QMTemplate = new QMTemplate(this.getPathFromJenkinsfileName(this.jenkinsfileName as string));
                                    return project.addFile("Jenkinsfile",
                                        jenkinsTemplate.build({}));
                                })
                                .then(() => {
                                    return project.isClean()
                                        .then(clean => {
                                            logger.debug(`Jenkinsfile has been added: ${clean.success}`);

                                            if (!clean.success) {
                                                return project.setUserConfig(
                                                    QMConfig.subatomic.bitbucket.auth.username,
                                                    QMConfig.subatomic.bitbucket.auth.email,
                                                )
                                                    .then(() => project.commit(`Added Jenkinsfile`))
                                                    .then(() => project.push());
                                            } else {
                                                logger.debug("Jenkinsfile already exists");
                                                return clean;
                                            }
                                        });
                                });
                        });
                });
        }
        return jenkinsfilePromise;
    }

    private doConfiguration(ctx: HandlerContext,
                            projectName: string,
                            projectId: string,
                            applicationName: string,
                            applicationType: string,
                            bitbucketProjectKey: string,
                            bitbucketRepoName: string,
                            bitbucketRepoRemoteUrl: string,
                            owningTeamName: string,
                            associatedTeams: any[]): Promise<HandlerResult> {

        const teamDevOpsProjectId = `${_.kebabCase(owningTeamName).toLowerCase()}-devops`;
        logger.debug(`Using owning team DevOps project: ${teamDevOpsProjectId}`);
        logger.debug(`Teams are: ${JSON.stringify(associatedTeams)}`);

        const jenkinsPromise: Promise<HandlerResult> = this.createJenkinsJob(
            teamDevOpsProjectId,
            projectName,
            projectId,
            applicationName,
            bitbucketProjectKey,
            bitbucketRepoName.toLowerCase(),
        );

        const jenkinsfilePromise = this.addJenkinsfilePromise(bitbucketProjectKey, bitbucketRepoName);
        return jenkinsfilePromise.then(() => {
                if (applicationType === ApplicationType.DEPLOYABLE.toString()) {
                    return jenkinsPromise
                        .then(() => {
                            const appBuildName = `${_.kebabCase(projectName).toLowerCase()}-${_.kebabCase(applicationName).toLowerCase()}`;
                            return OCCommon.createFromData({
                                apiVersion: "v1",
                                kind: "ImageStream",
                                metadata: {
                                    name: appBuildName,
                                },
                            }, [
                                new SimpleOption("-namespace", teamDevOpsProjectId),
                            ])
                                .then(() => {
                                    logger.info(`Using Git URI: ${bitbucketRepoRemoteUrl}`);

                                    // TODO this should be extracted to a configurable QMTemplate
                                    return OCCommon.createFromData({
                                            apiVersion: "v1",
                                            kind: "BuildConfig",
                                            metadata: {
                                                name: appBuildName,
                                            },
                                            spec: {
                                                source: {
                                                    type: "Git",
                                                    git: {
                                                        // temporary hack because of the NodePort
                                                        // TODO remove this!
                                                        uri: `${bitbucketRepoRemoteUrl.replace("7999", "30999")}`,
                                                        ref: "master",
                                                    },
                                                    sourceSecret: {
                                                        // TODO should this be configurable?
                                                        name: "bitbucket-ssh",
                                                    },
                                                },
                                                strategy: {
                                                    sourceStrategy: {
                                                        from: {
                                                            kind: "ImageStreamTag",
                                                            name: "jdk8-maven3-newrelic-subatomic:2.0",
                                                        },
                                                    },
                                                },
                                                output: {
                                                    to: {
                                                        kind: "ImageStreamTag",
                                                        name: `${appBuildName}:latest`,
                                                    },
                                                },
                                            },
                                        },
                                        [
                                            new SimpleOption("-namespace", teamDevOpsProjectId),
                                        ], true); // TODO clean up this hack - cannot be a boolean (magic)
                                })
                                .then(() => {
                                    return gluonProjectFromProjectName(ctx, projectName).then(project => {
                                        logger.info(`Trying to find tenant: ${project.owningTenant}`);
                                        return gluonTenantFromTenantId(project.owningTenant).then(tenant => {
                                            logger.info(`Found tenant: ${tenant}`);
                                            return this.createApplicationOpenshiftResources(tenant.name, project.name, applicationName);
                                        });
                                    });

                                });
                        })
                        .then(() => {
                            return ctx.messageClient.addressChannels({
                                text: `Your application *${applicationName}*, in project *${projectName}*, has been provisioned successfully ` +
                                "and is ready to build and deploy to your project environments",
                                attachments: [{
                                    fallback: `Your application has been provisioned successfully`,
                                    footer: `For more information, please read the ${this.docs() + "#jenkins-build"}`,
                                    text: `
You can kick off the build pipeline for your application by clicking the button below or pushing changes to your application's repository`,
                                    mrkdwn_in: ["text"],
                                    actions: [
                                        buttonForCommand(
                                            {
                                                text: "Start build",
                                                style: "primary",
                                            },
                                            new KickOffJenkinsBuild(),
                                            {
                                                projectName,
                                                applicationName,
                                            }),
                                    ],
                                }],
                            }, associatedTeams.map(team =>
                                team.slack.teamChannel));
                        });
                } else {
                    return jenkinsPromise
                        .then(() => {
                                return ctx.messageClient.addressChannels({
                                    text: "Your library has been provisioned successfully and is ready to build",
                                    attachments: [{
                                        fallback: `Your library has been provisioned successfully`,
                                        footer: `For more information, please read the ${this.docs() + "#jenkins-build"}`,
                                        text: `
You can kick off the build pipeline for your library by clicking the button below or pushing changes to your library's repository`,
                                        mrkdwn_in: ["text"],
                                        actions: [
                                            buttonForCommand(
                                                {
                                                    text: "Start build",
                                                    style: "primary",
                                                },
                                                new KickOffJenkinsBuild(),
                                                {
                                                    projectName,
                                                    applicationName,
                                                }),
                                        ],
                                    }],
                                }, associatedTeams.map(team =>
                                    team.slack.teamChannel));
                            },
                        );
                }
            },
        );

    }

    private createApplicationOpenshiftResources(tenantName: string, projectName: string, applicationName: string): Promise<any[]> {
        return Promise.all([["dev"],
            ["sit"],
            ["uat"]]
            .map(environment => {
                const projectId = getProjectId(tenantName, projectName, environment[0]);
                const appName = `${_.kebabCase(applicationName).toLowerCase()}`;
                const devOpsProjectId = getProjectDevOpsId(tenantName, projectName);
                logger.info(`Processing app [${appName}] Template for: ${projectId}`);

                return OCCommon.commonCommand("get", "templates",
                    [this.openshiftTemplate],
                    [
                        new SimpleOption("-namespace", "subatomic"),
                        new SimpleOption("-output", "json"),
                    ],
                )
                    .then(template => {
                        const appTemplate: any = JSON.parse(template.output);
                        appTemplate.metadata.namespace = projectId;
                        return OCCommon.createFromData(appTemplate,
                            [
                                new SimpleOption("-namespace", projectId),
                            ]
                            , );
                    })
                    .then(() => {
                        return OCCommon.commonCommand("process",
                            this.openshiftTemplate,
                            [],
                            [
                                new SimpleOption("p", `APP_NAME=${appName}`),
                                new SimpleOption("p", `IMAGE_STREAM_PROJECT=${projectId}`),
                                new SimpleOption("p", `DEVOPS_NAMESPACE=${devOpsProjectId}`),
                                new SimpleOption("-namespace", projectId),
                            ],
                        )
                            .then(appTemplate => {
                                logger.debug(`Processed app [${appName}] Template: ${appTemplate.output}`);

                                return OCCommon.commonCommand("get", `dc/${appName}`, [],
                                    [
                                        new SimpleOption("-namespace", projectId),
                                    ])
                                    .then(() => {
                                        logger.warn(`App [${appName}] Template has already been processed, deployment exists`);
                                        return SuccessPromise;
                                    }, () => {
                                        return OCCommon.createFromData(JSON.parse(appTemplate.output),
                                            [
                                                new SimpleOption("-namespace", projectId),
                                            ]);
                                    });
                            });
                    });
            }));
    }

    private createJenkinsJob(teamDevOpsProjectId: string,
                             gluonProjectName: string,
                             gluonProjectId: string,
                             gluonApplicationName: string,
                             bitbucketProjectKey: string,
                             bitbucketRepositoryName: string): Promise<HandlerResult> {
        return OCCommon.commonCommand("serviceaccounts",
            "get-token",
            [
                "subatomic-jenkins",
            ], [
                new SimpleOption("-namespace", teamDevOpsProjectId),
            ])
            .then(token => {
                return OCCommon.commonCommand(
                    "get",
                    "route/jenkins",
                    [],
                    [
                        new SimpleOption("-output", "jsonpath={.spec.host}"),
                        new SimpleOption("-namespace", teamDevOpsProjectId),
                    ])
                    .then(jenkinsHost => {
                        logger.debug(`Using Jenkins Route host [${jenkinsHost.output}] to add Bitbucket credentials`);

                        const jenkinsTemplate: QMTemplate = new QMTemplate("templates/jenkins/jenkins-multi-branch-project.xml");
                        const builtTemplate: string = jenkinsTemplate.build(
                            {
                                gluonApplicationName,
                                gluonBaseUrl: QMConfig.subatomic.gluon.baseUrl,
                                gluonProjectId,
                                bitbucketBaseUrl: QMConfig.subatomic.bitbucket.baseUrl,
                                teamDevOpsProjectId,
                                bitbucketProjectKey,
                                bitbucketRepositoryName,
                            },
                        );
                        const axios = jenkinsAxios();
                        return axios.post(`https://${jenkinsHost.output}/job/${_.kebabCase(gluonProjectName).toLowerCase()}/createItem?name=${_.kebabCase(gluonApplicationName).toLowerCase()}`,
                            builtTemplate,
                            {
                                headers: {
                                    "Content-Type": "application/xml",
                                    "Authorization": `Bearer ${token.output}`,
                                },
                            })
                            .then(success, error => {
                                if (error.response && error.response.status === 400) {
                                    logger.warn(`Multibranch job for [${gluonApplicationName}] probably already created`);
                                    return SuccessPromise;
                                } else {
                                    return failure(error);
                                }
                            });
                    });
            });
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference`,
            "documentation")}`;
    }
}
