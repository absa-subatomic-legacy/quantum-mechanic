import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import * as _ from "lodash";
import {timeout, TimeoutError} from "promise-timeout";
import {QMConfig} from "../../../config/QMConfig";
import {DevOpsMessages} from "../../messages/team/DevOpsMessages";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    ChannelMessageClient,
    handleQMError,
    QMError,
} from "../../util/shared/Error";
import {TaskListMessage, TaskStatus} from "../../util/shared/TaskListMessage";

const promiseRetry = require("promise-retry");

@EventHandler("Receive DevOpsEnvironmentProvisionedEvent events", `
subscription DevOpsEnvironmentProvisionedEvent {
  DevOpsEnvironmentProvisionedEvent {
    id
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    devOpsEnvironment{
        openshiftProjectId
        name
        description
    }
  }
}
`)
export class DevOpsEnvironmentProvisioned implements HandleEvent<any> {

    private devopsMessages = new DevOpsMessages();

    constructor(private jenkinsService = new JenkinsService(),
                private ocService = new OCService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested DevOpsEnvironmentProvisioned event: ${JSON.stringify(event.data)}`);

        const devOpsRequestedEvent = event.data.DevOpsEnvironmentProvisionedEvent[0];

        const teamChannel = devOpsRequestedEvent.team.slackIdentity.teamChannel;

        const taskList = new TaskListMessage(`🚀 Provisioning of DevOps jenkins for team *${devOpsRequestedEvent.team.name}* started:`, new ChannelMessageClient(ctx).addDestination(teamChannel));
        taskList.addTask("Template", "Tag jenkins template to environment");
        taskList.addTask("Jenkins", "Rollout Jenkins instance");
        taskList.addTask("ConfigJenkins", "Configure Jenkins");

        try {
            const projectId = `${_.kebabCase(devOpsRequestedEvent.team.name).toLowerCase()}-devops`;
            logger.info(`Working with OpenShift project Id: ${projectId}`);

            await taskList.display();

            await this.ocService.login();

            await this.copyJenkinsTemplateToDevOpsEnvironment(projectId);

            await taskList.setTaskStatus("Template", TaskStatus.Successful);

            await this.createJenkinsDeploymentConfig(projectId);

            await this.createJenkinsServiceAccount(projectId);

            await this.rolloutJenkinsDeployment(projectId);

            await taskList.setTaskStatus("Jenkins", TaskStatus.Successful);

            const jenkinsHost: string = await this.createJenkinsRoute(projectId);

            const token: string = await this.getJenkinsServiceAccountToken(projectId);

            logger.info(`Using Service Account token: ${token}`);

            await this.addJenkinsCredentials(projectId, jenkinsHost, token);

            await taskList.setTaskStatus("ConfigJenkins", TaskStatus.Successful);

            return await ctx.messageClient.addressChannels(
                this.devopsMessages.jenkinsSuccessfullyProvisioned(jenkinsHost, devOpsRequestedEvent.team.name),
                devOpsRequestedEvent.team.slackIdentity.teamChannel,
            );
        } catch (error) {
            await taskList.failRemainingTasks();
            return await this.handleError(ctx, error, devOpsRequestedEvent.team.slackIdentity.teamChannel);
        }
    }

    private async copyJenkinsTemplateToDevOpsEnvironment(projectId: string) {
        const jenkinsTemplateJSON = await this.ocService.getJenkinsTemplate();

        const jenkinsTemplate: any = JSON.parse(jenkinsTemplateJSON.output);
        jenkinsTemplate.metadata.namespace = projectId;
        await this.ocService.createResourceFromDataInNamespace(jenkinsTemplate, projectId);
    }

    private async createJenkinsDeploymentConfig(projectId: string) {
        logger.info("Processing Jenkins QMTemplate...");
        const jenkinsTemplateResultJSON = await this.ocService.processJenkinsTemplateForDevOpsProject(projectId);
        logger.debug(`Processed Jenkins Template: ${jenkinsTemplateResultJSON.output}`);

        try {
            await this.ocService.getDeploymentConfigInNamespace("jenkins", projectId);
            logger.warn("Jenkins QMTemplate has already been processed, deployment exists");
        } catch (error) {
            await this.ocService.createResourceFromDataInNamespace(JSON.parse(jenkinsTemplateResultJSON.output), projectId);
        }
    }

    private async createJenkinsServiceAccount(projectId: string) {
        const serviceAccountDefinition = {
            apiVersion: "v1",
            kind: "ServiceAccount",
            metadata: {
                annotations: {
                    "subatomic.bison.co.za/managed": "true",
                    "serviceaccounts.openshift.io/oauth-redirectreference.jenkins": '{"kind":"OAuthRedirectReference", "apiVersion":"v1","reference":{"kind":"Route","name":"jenkins"}}',
                },
                name: "subatomic-jenkins",
            },
        };
        await this.ocService.createResourceFromDataInNamespace(serviceAccountDefinition, projectId);

        const roleBindingDefinition = {
            apiVersion: "rbac.authorization.k8s.io/v1beta1",
            kind: "RoleBinding",
            metadata: {
                annotations: {
                    "subatomic.bison.co.za/managed": "true",
                },
                name: "subatomic-jenkins-edit",
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "admin",
            },
            subjects: [{
                kind: "ServiceAccount",
                name: "subatomic-jenkins",
            }],
        };

        await this.ocService.createResourceFromDataInNamespace(roleBindingDefinition, projectId, true);
    }

    private async rolloutJenkinsDeployment(projectId) {
        await promiseRetry((retryFunction, attemptCount: number) => {
            logger.debug(`Jenkins rollout status check attempt number ${attemptCount}`);

            return this.ocService.rolloutDeploymentConfigInNamespace("jenkins", projectId)
                .then(rolloutStatus => {
                    logger.debug(JSON.stringify(rolloutStatus.output));

                    if (rolloutStatus.output.indexOf("successfully rolled out") === -1) {
                        retryFunction();
                    }
                });
        }, {
            // Retry for up to 8 mins
            factor: 1,
            retries: 59,
            minTimeout: 20000,
        });
    }

    private async getJenkinsServiceAccountToken(projectId: string) {
        const tokenResult = await this.ocService.getServiceAccountToken("subatomic-jenkins", projectId);
        return tokenResult.output;
    }

    private async createJenkinsRoute(projectId: string): Promise<string> {

        await this.ocService.annotateJenkinsRoute(projectId);
        const jenkinsHost = await this.ocService.getJenkinsHost(projectId);

        return jenkinsHost.output;
    }

    private async addJenkinsCredentials(projectId: string, jenkinsHost: string, token: string) {
        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add Bitbucket credentials`);
        const bitbucketCredentials = {
            "": "0",
            "credentials": {
                scope: "GLOBAL",
                id: `${projectId}-bitbucket`,
                username: QMConfig.subatomic.bitbucket.auth.username,
                password: QMConfig.subatomic.bitbucket.auth.password,
                description: `${projectId}-bitbucket`,
                $class: "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl",
            },
        };

        await this.createGlobalCredentialsFor("Bitbucket", jenkinsHost, token, projectId, bitbucketCredentials);

        const nexusCredentials = {
            "": "0",
            "credentials": {
                scope: "GLOBAL",
                id: "nexus-base-url",
                secret: `${QMConfig.subatomic.nexus.baseUrl}/content/repositories/`,
                description: "Nexus base URL",
                $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
            },
        };

        await this.createGlobalCredentialsFor("Nexus", jenkinsHost, token, projectId, nexusCredentials);

        const mavenCredentials = {
            "": "0",
            "credentials": {
                scope: "GLOBAL",
                id: "maven-settings",
                file: "file",
                fileName: "settings.xml",
                description: "Maven settings.xml",
                $class: "org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl",
            },
        };

        await this.createGlobalCredentialsFor("Maven", jenkinsHost, token, projectId, mavenCredentials, {
            filePath: QMConfig.subatomic.maven.settingsPath,
            fileName: "settings.xml",
        });
    }

    private async createGlobalCredentialsFor(forName: string, jenkinsHost: string, token: string, projectId: string, credentials, fileDetails: { fileName: string, filePath: string } = null) {
        try {
            await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, projectId, credentials, fileDetails);
        } catch (error) {
            throw new QMError(`Failed to create ${forName} Global Credentials in Jenkins`);
        }
    }

    private async handleError(ctx: HandlerContext, error, teamChannel: string) {
        return await handleQMError(new ChannelMessageClient(ctx).addDestination(teamChannel), error);
    }
}
