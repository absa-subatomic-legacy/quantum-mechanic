import {HandlerContext, logger} from "@atomist/automation-client";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {QMTemplate} from "../../../template/QMTemplate";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {getJenkinsBitbucketAccessCredential} from "../../util/jenkins/JenkinsCredentials";
import {
    getAllPipelineOpenshiftNamespaces,
    OpenShiftProjectNamespace,
    QMDeploymentPipeline,
} from "../../util/project/Project";
import {QMError} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigureJenkinsForProject extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureProjectJenkins");
    private readonly TASK_ADD_JENKINS_SA_RIGHTS = TaskListMessage.createUniqueTaskName("JenkinsSAEdit");
    private readonly TASK_CREATE_JENKINS_BUILD_TEMPLATE = TaskListMessage.createUniqueTaskName("JenkinsBuildTemplate");
    private readonly TASK_ADD_JENKINS_CREDENTIALS = TaskListMessage.createUniqueTaskName("JenkinsCredentials");

    private allEnvironmentsForCreation: OpenShiftProjectNamespace[];

    constructor(private environmentsRequestedEvent,
                private devDeployPipelineForCreation: QMDeploymentPipeline,
                private releaseDeploymentPipelinesForCreation: QMDeploymentPipeline[],
                private openshiftEnvironment: OpenShiftConfig,
                private ocService = new OCService(),
                private jenkinsService = new JenkinsService()) {
        super();
        this.allEnvironmentsForCreation = getAllPipelineOpenshiftNamespaces(this.environmentsRequestedEvent.owningTenant.name, this.environmentsRequestedEvent.project.name, devDeployPipelineForCreation);
        for (const pipeline of releaseDeploymentPipelinesForCreation) {
            this.allEnvironmentsForCreation.push(...getAllPipelineOpenshiftNamespaces(this.environmentsRequestedEvent.owningTenant.name, this.environmentsRequestedEvent.project.name, pipeline));
        }
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_HEADER, `*Configure project in Jenkins on ${this.openshiftEnvironment.name}*`);
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_SA_RIGHTS, "\tGrant Jenkins Service Account permissions");
        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_BUILD_TEMPLATE, "\tCreate Jenkins build folder");
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_CREDENTIALS, "\tAdd project environment credentials to Jenkins");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        const teamDevOpsProjectId = getDevOpsEnvironmentDetails(this.environmentsRequestedEvent.teams[0].name).openshiftProjectId;

        await this.ocService.setOpenShiftDetails(this.openshiftEnvironment);

        await this.addEditRolesToJenkinsServiceAccount(
            teamDevOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_SA_RIGHTS);

        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);
        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add Bitbucket credentials`);

        await this.createJenkinsBuildTemplate(this.environmentsRequestedEvent, teamDevOpsProjectId, jenkinsHost, token);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_BUILD_TEMPLATE);

        await this.createJenkinsCredentials(teamDevOpsProjectId, jenkinsHost, token);

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_CREDENTIALS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

    private async addEditRolesToJenkinsServiceAccount(teamDevOpsProjectId: string) {

        for (const environment of this.allEnvironmentsForCreation) {
            await this.ocService.addRoleToUserInNamespace(
                `system:serviceaccount:${teamDevOpsProjectId}:jenkins`,
                "edit",
                environment.namespace);
        }

    }

    private async createJenkinsBuildTemplate(environmentsRequestedEvent, teamDevOpsProjectId: string, jenkinsHost: string, token: string) {
        const projectTemplate: QMTemplate = new QMTemplate("resources/templates/jenkins/jenkins-openshift-environment-credentials.xml");

        const parameters: { [k: string]: any } = {
            projectName: environmentsRequestedEvent.project.name,
            docsUrl: QMConfig.subatomic.docs.baseUrl,
            teamDevOpsProjectId,
            deploymentEnvironments: this.allEnvironmentsForCreation,
        };

        const builtTemplate: string = projectTemplate.build(parameters);
        logger.info("Template found and built successfully.");
        const jenkinsCreateItemResult = await this.jenkinsService.createOpenshiftEnvironmentCredentials(jenkinsHost, token, environmentsRequestedEvent.project.name, builtTemplate);

        if (!isSuccessCode(jenkinsCreateItemResult.status)) {
            if (jenkinsCreateItemResult.status === 400) {
                logger.warn(`Folder for [${environmentsRequestedEvent.project.name}] probably already created`);
            } else {
                throw new QMError("Failed to create jenkins build template. Network timeout occurred.");
            }
        }
    }

    private async createJenkinsCredentials(teamDevOpsProjectId: string, jenkinsHost: string, token: string) {

        const jenkinsCredentials = getJenkinsBitbucketAccessCredential(teamDevOpsProjectId);

        await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, teamDevOpsProjectId, jenkinsCredentials);
    }

}
