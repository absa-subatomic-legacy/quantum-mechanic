import {HandlerContext, logger} from "@atomist/automation-client";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {OCService} from "../../services/openshift/OCService";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class CreateConfigServer extends Task {

    private readonly TASK_CONFIG_SERVER_SECRET = TaskListMessage.createUniqueTaskName("ConfigServerSecret");
    private readonly TASK_CONFIG_SERVER_CONFIG_MAP = TaskListMessage.createUniqueTaskName("ConfigServerConfigMap");
    private readonly TASK_TAG_CONFIG_SERVER_IMAGE = TaskListMessage.createUniqueTaskName("TagImage");
    private readonly TASK_SET_SERVICE_ACCOUNT_PERMISSIONS = TaskListMessage.createUniqueTaskName("ServiceAccountPermissions");
    private readonly TASK_CREATE_DEPLOYMENT_CONFIG = TaskListMessage.createUniqueTaskName("DeploymentConfig");

    constructor(private gluonTeamName,
                private openShiftCloud,
                private gitRepoSSHURI,
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_CONFIG_SERVER_SECRET, `\tCreate Config Server Secret`);
        taskListMessage.addTask(this.TASK_CONFIG_SERVER_CONFIG_MAP, `\tCreate Config Server Config Map`);
        taskListMessage.addTask(this.TASK_TAG_CONFIG_SERVER_IMAGE, `\tTag Config Server image to DevOps`);
        taskListMessage.addTask(this.TASK_SET_SERVICE_ACCOUNT_PERMISSIONS, `\tGrant Service Account correct permissions`);
        taskListMessage.addTask(this.TASK_CREATE_DEPLOYMENT_CONFIG, `\tCreate Config Server Deployment Config`);
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);
        const devOpsProjectId = getDevOpsEnvironmentDetails(this.gluonTeamName).openshiftProjectId;
        await this.addConfigServerSecretToDevOpsEnvironment(devOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_CONFIG_SERVER_SECRET);

        await this.createConfigServerConfigurationMap(devOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_CONFIG_SERVER_CONFIG_MAP);

        await this.tagConfigServerImageToDevOpsEnvironment(devOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_TAG_CONFIG_SERVER_IMAGE);

        await this.addViewRoleToDevOpsEnvironmentDefaultServiceAccount(devOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_SET_SERVICE_ACCOUNT_PERMISSIONS);

        await this.createConfigServerDeploymentConfig(this.gitRepoSSHURI, devOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_DEPLOYMENT_CONFIG);

        return true;
    }

    private async addConfigServerSecretToDevOpsEnvironment(devOpsProjectId: string) {
        try {
            await this.ocService.createConfigServerSecret(devOpsProjectId);
        } catch (error) {
            logger.warn("Secret subatomic-config-server probably already exists");
        }
    }

    private async createConfigServerConfigurationMap(devOpsProjectId: string) {
        const configurationMapDefintion = {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
                name: "subatomic-config-server",
            },
            data: {
                "application.yml": `
spring:
  cloud:
    config:
      server:
        git:
          ignoreLocalSshSettings: true
          strictHostKeyChecking: false
          hostKeyAlgorithm: ssh-rsa
`,
            },
        };
        return await this.ocService.applyResourceFromDataInNamespace(configurationMapDefintion, devOpsProjectId);
    }

    private async tagConfigServerImageToDevOpsEnvironment(devOpsProjectId: string) {
        return await this.ocService.tagSubatomicImageToNamespace(
            "subatomic-config-server:3.0",
            devOpsProjectId,
            "subatomic-config-server:3.0");
    }

    private async addViewRoleToDevOpsEnvironmentDefaultServiceAccount(devOpsProjectId: string) {
        return await this.ocService.addRoleToUserInNamespace(
            `system:serviceaccount:${devOpsProjectId}:default`,
            "view",
            devOpsProjectId);
    }

    private async createConfigServerDeploymentConfig(gitUri: string, devOpsProjectId: string) {
        try {
            await this.ocService.getDeploymentConfigInNamespace("subatomic-config-server", devOpsProjectId);
            logger.warn(`Subatomic Config Server Template has already been processed, deployment exists`);
        } catch (error) {
            const saneGitUri = _.replace(gitUri, /(<)|>/g, "");

            const templateParameters = [
                {key: "GIT_URI", value: saneGitUri},
                {key: "IMAGE_STREAM_PROJECT", value: devOpsProjectId},
            ];

            const appTemplate = await this.ocService.findAndProcessOpenshiftTemplate(
                "subatomic-config-server-template",
                "subatomic",
                templateParameters);

            logger.debug(`Processed Subatomic Config Server Template: ${JSON.stringify(appTemplate)}`);

            await this.ocService.applyResourceFromDataInNamespace(appTemplate, devOpsProjectId);
        }
    }

}
