import {logger} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {QMContext} from "../../../context/QMContext";
import {JenkinsDevOpsCredentialsService} from "../../services/jenkins/JenkinsDevOpsCredentialsService";
import {OCService} from "../../services/openshift/OCService";
import {getSubatomicJenkinsServiceAccountName} from "../../util/jenkins/Jenkins";
import {
    roleBindingDefinition,
    serviceAccountDefinition,
} from "../../util/jenkins/JenkinsOpenshiftResources";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

const promiseRetry = require("promise-retry");

export class AddJenkinsToDevOpsEnvironment extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureDevOpsJenkins");
    private readonly TASK_ROLLOUT_JENKINS = TaskListMessage.createUniqueTaskName("RolloutJenkins");
    private readonly TASK_CONFIG_JENKINS = TaskListMessage.createUniqueTaskName("ConfigJenkins");

    constructor(private team: QMTeam,
                private jenkinsDevOpsCredentialsService = new JenkinsDevOpsCredentialsService(),
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_HEADER, `*Create DevOps Jenkins*`);
        taskListMessage.addTask(this.TASK_ROLLOUT_JENKINS, "\tRollout Jenkins instance");
        taskListMessage.addTask(this.TASK_CONFIG_JENKINS, "\tConfigure Jenkins");
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {

        const projectId = getDevOpsEnvironmentDetails(this.team.name).openshiftProjectId;
        logger.info(`Working with OpenShift project Id: ${projectId}`);

        const openShiftCloud = this.team.openShiftCloud;

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[openShiftCloud].openshiftNonProd);

        await this.createJenkinsDeploymentConfig(
            projectId,
            QMConfig.subatomic.openshiftClouds[openShiftCloud].sharedResourceNamespace,
            QMConfig.subatomic.openshiftClouds[openShiftCloud].openshiftNonProd.internalDockerRegistryUrl,
        );

        await this.createSubatomicJenkinsServiceAccount(projectId);

        await this.rolloutJenkinsDeployment(projectId);

        await this.taskListMessage.succeedTask(this.TASK_ROLLOUT_JENKINS);

        const jenkinsHost: string = await this.createJenkinsRoute(projectId);

        const token: string = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), projectId);

        logger.info(`Using Service Account token: ${token}`);

        await this.jenkinsDevOpsCredentialsService.createDevOpsJenkinsGlobalCredentials(projectId, jenkinsHost, token, openShiftCloud);

        await this.taskListMessage.succeedTask(this.TASK_CONFIG_JENKINS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

    private async createJenkinsDeploymentConfig(projectId: string, sharedResourceNamespace: string, dockerRegistryUrl: string) {
        logger.info("Processing Jenkins QMFileTemplate...");
        const openShiftResourceList = await this.ocService.processJenkinsTemplateForDevOpsProject(projectId, sharedResourceNamespace, dockerRegistryUrl);
        try {
            await this.ocService.getDeploymentConfigInNamespace("jenkins", projectId);
            logger.warn("Jenkins QMFileTemplate has already been processed, deployment exists");
        } catch (error) {
            await this.ocService.applyResourceFromDataInNamespace(openShiftResourceList, projectId);
        }

        // Give image-puller permissions to the created jenkins service account
        await this.ocService.addRoleToUserInNamespace(
            `system:serviceaccount:${projectId}:jenkins`,
            "system:image-pullers",
            QMConfig.subatomic.openshiftClouds[this.team.openShiftCloud].sharedResourceNamespace);
    }

    private async createSubatomicJenkinsServiceAccount(projectId: string) {
        await this.ocService.applyResourceFromDataInNamespace(serviceAccountDefinition(), projectId);

        await this.ocService.applyResourceFromDataInNamespace(roleBindingDefinition(), projectId, true);
    }

    private async rolloutJenkinsDeployment(projectId) {
        await promiseRetry((retryFunction, attemptCount: number) => {
            logger.debug(`Jenkins roll-out status check, attempt number ${attemptCount}`);

            return this.ocService.rolloutDeploymentConfigInNamespace("jenkins", projectId)
                .then(openShiftResource => {
                    if (openShiftResource.spec.replicas === openShiftResource.status.availableReplicas) {
                        logger.debug(`Successfully rolled out Jenkins for project ${projectId}`);
                    } else {
                        logger.debug(`Rechecking status...`);
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

    private async createJenkinsRoute(projectId: string): Promise<string> {
        await this.ocService.annotateJenkinsRoute(projectId);
        return await this.ocService.getJenkinsHost(projectId);
    }

}
