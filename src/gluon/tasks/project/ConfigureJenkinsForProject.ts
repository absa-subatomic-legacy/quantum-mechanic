import {logger} from "@atomist/automation-client";
import _ = require("lodash");
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {QMContext} from "../../../context/QMContext";
import {isSuccessCode} from "../../../http/Http";
import {QMFileTemplate} from "../../../template/QMTemplate";
import {
    JenkinsCredentialsFolder,
    JenkinsService,
} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {getSubatomicJenkinsServiceAccountName} from "../../util/jenkins/Jenkins";
import {
    getJenkinsBitbucketAccessCredential,
    getOpenshiftEnvironmentCredential,
} from "../../util/jenkins/JenkinsCredentials";
import {
    getAllPipelineOpenshiftNamespaces,
    OpenshiftProjectEnvironmentRequest,
    OpenShiftProjectNamespace,
    } from "../../util/project/Project";
import {QMError} from "../../util/shared/Error";
import {retryFunction} from "../../util/shared/RetryFunction";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";
import {QMDeploymentPipeline} from "../../util/transform/types/gluon/Project";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigureJenkinsForProject extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureProjectJenkins");
    private readonly TASK_ADD_JENKINS_SA_RIGHTS = TaskListMessage.createUniqueTaskName("JenkinsSAEdit");
    private readonly TASK_CREATE_JENKINS_BUILD_TEMPLATE = TaskListMessage.createUniqueTaskName("JenkinsBuildTemplate");
    private readonly TASK_ADD_JENKINS_CREDENTIALS = TaskListMessage.createUniqueTaskName("JenkinsCredentials");

    private readonly allEnvironmentsForCreation: OpenShiftProjectNamespace[];

    constructor(private jenkinsProjectDetails: OpenshiftProjectEnvironmentRequest,
                private devDeployPipelineForCreation: QMDeploymentPipeline,
                private releaseDeploymentPipelinesForCreation: QMDeploymentPipeline[],
                private openshiftEnvironment: OpenShiftConfig,
                private ocService = new OCService(),
                private jenkinsService = new JenkinsService()) {
        super();
        this.allEnvironmentsForCreation = getAllPipelineOpenshiftNamespaces(this.jenkinsProjectDetails.owningTenant.name, this.jenkinsProjectDetails.project.name, devDeployPipelineForCreation);
        for (const pipeline of releaseDeploymentPipelinesForCreation) {
            this.allEnvironmentsForCreation.push(...getAllPipelineOpenshiftNamespaces(this.jenkinsProjectDetails.owningTenant.name, this.jenkinsProjectDetails.project.name, pipeline));
        }
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_HEADER, `*Configure ${this.jenkinsProjectDetails.project.name} project in Jenkins on ${this.openshiftEnvironment.name}*`);
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_SA_RIGHTS, "\tGrant Jenkins Service Account permissions");
        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_BUILD_TEMPLATE, "\tCreate Jenkins build folder");
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_CREDENTIALS, "\tAdd project environment credentials to Jenkins");
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {
        const teamDevOpsProjectId = getDevOpsEnvironmentDetails(this.jenkinsProjectDetails.teams[0].name).openshiftProjectId;

        await this.ocService.setOpenShiftDetails(this.openshiftEnvironment);

        await this.addEditRolesToJenkinsServiceAccount(
            teamDevOpsProjectId);

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_SA_RIGHTS);

        const token = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), teamDevOpsProjectId);
        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add Bitbucket credentials`);

        await this.createJenkinsBuildTemplate(this.jenkinsProjectDetails, teamDevOpsProjectId, jenkinsHost, token);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_BUILD_TEMPLATE);

        await this.createJenkinsCredentials(teamDevOpsProjectId, jenkinsHost, token, this.jenkinsProjectDetails.project.name);

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
        const projectTemplate: QMFileTemplate = new QMFileTemplate("resources/templates/jenkins/jenkins-openshift-environment-credentials.xml");

        const parameters: { [k: string]: any } = {
            projectName: environmentsRequestedEvent.project.name,
            docsUrl: QMConfig.subatomic.docs.baseUrl,
            teamDevOpsProjectId,
            projectCredentialsDomain: this.jenkinsService.getProjectCredentialsDomain(environmentsRequestedEvent.project.name),
            deploymentEnvironments: this.allEnvironmentsForCreation,
        };

        const builtTemplate: string = projectTemplate.build(parameters);
        logger.info("Template found and built successfully.");
        const result = await retryFunction(5, 5000, async (attemptNumber: number) => {
            logger.info(`Trying to create jenkins credentials. Attempt number ${attemptNumber}.`);
            const jenkinsCreateItemResult = await this.jenkinsService.createOpenshiftEnvironmentCredentials(jenkinsHost, token, environmentsRequestedEvent.project.name, builtTemplate);
            if (!isSuccessCode(jenkinsCreateItemResult.status)) {
                if (jenkinsCreateItemResult.status === 400) {
                    logger.warn(`Folder for [${environmentsRequestedEvent.project.name}] probably already created`);
                    return true;
                } else {
                    return false;
                }
            }
            return true;
        });
        if (!result) {
            throw new QMError("Failed to create jenkins build template. Network timeout occurred.");
        }
    }

    private async createJenkinsCredentials(teamDevOpsProjectId: string, jenkinsHost: string, token: string, projectName: string) {

        for (const environment of this.allEnvironmentsForCreation) {
            const environmentCredential = getOpenshiftEnvironmentCredential(environment);
            const jenkinsCredentialsFolder: JenkinsCredentialsFolder = {
                domain: this.jenkinsService.getProjectCredentialsDomain(projectName),
                jobName: _.kebabCase(projectName),
            };
            await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, environmentCredential, undefined, jenkinsCredentialsFolder);
        }

        const jenkinsCredentials = getJenkinsBitbucketAccessCredential(teamDevOpsProjectId);

        await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, jenkinsCredentials);
    }

}
