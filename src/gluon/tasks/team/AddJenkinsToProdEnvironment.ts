import {HandlerContext, logger} from "@atomist/automation-client";
import * as _ from "lodash";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class AddJenkinsToProdEnvironment extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureProjectJenkins");
    private readonly TASK_CREATE_JENKINS_SA = "CreateJenkinsSA";
    private readonly TASK_ADD_JENKINS_SA_RIGHTS = TaskListMessage.createUniqueTaskName("JenkinsSAEdit");
    private readonly TASK_ADD_JENKINS_CREDENTIALS = TaskListMessage.createUniqueTaskName("JenkinsCredentials");

    constructor(private devOpsRequestedEvent,
                private openshiftEnvironment: OpenShiftConfig = QMConfig.subatomic.openshiftProd[0],
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
        const teamDevOpsProjectId = getDevOpsEnvironmentDetails(this.devOpsRequestedEvent.team.name).openshiftProjectId;
        const projectId = `${_.kebabCase(this.devOpsRequestedEvent.team.name).toLowerCase()}-devops-prod`;
        logger.info(`Working with OpenShift project Id: ${projectId}`);

        await this.ocService.login();

        await this.createJenkinsServiceAccount(projectId);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_SA);
        logger.info(`!!!!${JSON.stringify(this.devOpsRequestedEvent)}`);
        logger.info(`!!!!${JSON.stringify(this.openshiftEnvironment)}`);
        await this.addEditRolesToJenkinsServiceAccount(teamDevOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_SA_RIGHTS);

        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);
        const jenkinsHost = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.info(`!!!!!${token.output}`);
        await this.createJenkinsCredentials(teamDevOpsProjectId, jenkinsHost.output, token.output, this.openshiftEnvironment.name);

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_CREDENTIALS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
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

    private async addEditRolesToJenkinsServiceAccount(teamDevOpsProjectId: string) {

        await this.ocService.login(this.openshiftEnvironment);

        await this.ocService.addRoleToUserInNamespace(
            `system:serviceaccount:${teamDevOpsProjectId}:jenkins`,
            "edit",
            teamDevOpsProjectId);
    }

    private async createJenkinsCredentials(teamDevOpsProjectId: string, jenkinsHost: string, token: string, prodName: string) {

        const jenkinsCredentials = {
            "": "0",
            "credentials": {
                scope: "GLOBAL",
                id: `${teamDevOpsProjectId}-${prodName}`,
                secret: token,
                description: `${teamDevOpsProjectId}-${prodName}`,
                $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
            },
        };

        await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, teamDevOpsProjectId, jenkinsCredentials);
    }
}
