import {HandlerContext, logger} from "@atomist/automation-client";
import _ = require("lodash");
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {
    JenkinsCredentialsFolder,
    JenkinsService,
} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {getSubatomicJenkinsServiceAccountName} from "../../util/jenkins/Jenkins";
import {getOpenshiftEnvironmentCredential} from "../../util/jenkins/JenkinsCredentials";
import {
    roleBindingDefinition,
    serviceAccountDefinition,
} from "../../util/jenkins/JenkinsOpenshiftResources";
import {OpenShiftProjectNamespace, QMProject} from "../../util/project/Project";
import {
    getDevOpsEnvironmentDetails,
    getDevOpsEnvironmentDetailsProd,
    QMTeam,
} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class AddJenkinsToProdEnvironment extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureProjectJenkins");
    private readonly TASK_CREATE_JENKINS_SA = TaskListMessage.createUniqueTaskName("CreateJenkinsSA");
    private readonly TASK_ADD_JENKINS_SA_RIGHTS = TaskListMessage.createUniqueTaskName("JenkinsSAEdit");
    private readonly TASK_ADD_JENKINS_CREDENTIALS = TaskListMessage.createUniqueTaskName("JenkinsCredentials");

    constructor(private projectDetails: { team: QMTeam, project: QMProject },
                private prodOpenShiftNamespaces: OpenShiftProjectNamespace[],
                private openshiftEnvironment: OpenShiftConfig,
                private jenkinsService = new JenkinsService(),
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_HEADER, `*Configure project in Jenkins on ${this.openshiftEnvironment.name}*`);
        taskListMessage.addTask(this.TASK_CREATE_JENKINS_SA, "\tCreate Jenkins Service Account");
        taskListMessage.addTask(this.TASK_ADD_JENKINS_SA_RIGHTS, "\tGrant Jenkins Service Account permissions");
        taskListMessage.addTask(this.TASK_ADD_JENKINS_CREDENTIALS, "\tAdd project environment credentials to Jenkins");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        const teamDevOpsNonProd = getDevOpsEnvironmentDetails(this.projectDetails.team.name).openshiftProjectId;
        const teamDevOpsProd = getDevOpsEnvironmentDetailsProd(this.projectDetails.team.name).openshiftProjectId;
        logger.info(`Working with OpenShift project Id: ${teamDevOpsProd}`);

        await this.ocService.setOpenShiftDetails(this.openshiftEnvironment);

        await this.createJenkinsServiceAccount(teamDevOpsProd);
        const prodToken = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), teamDevOpsProd);
        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_SA);

        for (const environment of this.prodOpenShiftNamespaces) {
            logger.info(`Working with OpenShift project Id: ${environment.namespace}`);
            await this.addEditRolesToJenkinsServiceAccount(teamDevOpsProd, environment.namespace);
        }
        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_SA_RIGHTS);

        // Add the prod token to the non prod jenkins instance
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.projectDetails.team.openShiftCloud].openshiftNonProd);

        const jenkinsToken = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), teamDevOpsNonProd);

        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsNonProd);

        await this.createJenkinsOpenShiftTokenCredentials(this.projectDetails.team.name, jenkinsHost, jenkinsToken, this.openshiftEnvironment.name, prodToken);

        await this.createJenkinsProjectNameCredentials(jenkinsHost, jenkinsToken, this.projectDetails.project.name);

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_CREDENTIALS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

    private async createJenkinsServiceAccount(projectId: string) {
        await this.ocService.applyResourceFromDataInNamespace(serviceAccountDefinition(), projectId);

        await this.ocService.applyResourceFromDataInNamespace(roleBindingDefinition(), projectId, true);
    }

    private async addEditRolesToJenkinsServiceAccount(teamDevOpsProd: string, destinationNamespace: string) {

        await this.ocService.addRoleToUserInNamespace(
            `system:serviceaccount:${teamDevOpsProd}:subatomic-jenkins`,
            "edit",
            destinationNamespace);
    }

    private async createJenkinsOpenShiftTokenCredentials(teamName: string, jenkinsHost: string, token: string, prodName: string, secretValue: string) {

        const jenkinsCredentials = {
            "": "0",
            "credentials": {
                scope: "GLOBAL",
                id: `${_.kebabCase(teamName)}-${_.kebabCase(prodName)}`.toLowerCase(),
                secret: secretValue,
                description: `${teamName} ${prodName} token`,
                $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
            },
        };

        await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, jenkinsCredentials);
    }

    private async createJenkinsProjectNameCredentials(jenkinsHost: string, token: string, projectName: string) {

        for (const environment of this.prodOpenShiftNamespaces) {
            const environmentCredential = getOpenshiftEnvironmentCredential(environment);
            const jenkinsCredentialsFolder: JenkinsCredentialsFolder = {
                domain: this.jenkinsService.getProjectCredentialsDomain(projectName),
                jobName: _.kebabCase(projectName),
            };
            await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, environmentCredential, undefined, jenkinsCredentialsFolder);
        }
    }
}
