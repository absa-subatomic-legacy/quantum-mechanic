import {
    BitBucketServerRepoRef,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {GitCommandGitProject} from "@atomist/automation-client/lib/project/git/GitCommandGitProject";
import {GitProject} from "@atomist/automation-client/lib/project/git/GitProject";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {QMFileTemplate} from "../../../template/QMTemplate";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    getApplicationJenkinsJobDisplayName,
    getPathFromJenkinsfileName,
} from "../../util/jenkins/Jenkins";
import {JenkinsDeploymentJobTemplate} from "../../util/jenkins/JenkinsJobTemplates";
import {QMProject} from "../../util/project/Project";
import {GitError, QMError} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigurePackageDeploymentPipelineInJenkins extends Task {

    private readonly TASK_ADD_JENKINS_FILE = TaskListMessage.createUniqueTaskName("AddJenkinsfile");
    private readonly TASK_CREATE_JENKINS_JOB = TaskListMessage.createUniqueTaskName("CreateJenkinsJob");

    constructor(private application: QMApplication,
                private project: QMProject,
                private jenkinsDeploymentJobConfigs: JenkinsDeploymentJobTemplate[],
                private ocService = new OCService(),
                private gluonService = new GluonService(),
                private jenkinsService = new JenkinsService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_FILE, "Add Jenkinsfiles");

        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_JOB, "Create Jenkins Jobs");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(this.project.owningTeam.teamId);
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd);

        await this.addJenkinsFiles(
            this.application,
            this.jenkinsDeploymentJobConfigs,
            this.project.bitbucketProject.key,
            this.application.bitbucketRepository.slug,
        );
        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_FILE);

        const devopsDetails = getDevOpsEnvironmentDetails(this.project.owningTeam.name);

        await this.createJenkinsJobs(
            devopsDetails.openshiftProjectId,
            this.project,
            this.application,
            this.jenkinsDeploymentJobConfigs);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_JOB);

        logger.info(`PackageConfigured successfully`);

        return true;
    }

    private async createJenkinsJobs(teamDevOpsProjectId: string,
                                    project: QMProject,
                                    application: QMApplication,
                                    jenkinsJobTemplates: JenkinsDeploymentJobTemplate[]): Promise<HandlerResult> {
        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);
        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);
        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add Bitbucket credentials`);

        for (const jenkinsJobTemplate of jenkinsJobTemplates) {
            const jenkinsTemplate: QMFileTemplate = new QMFileTemplate(`resources/templates/jenkins/${jenkinsJobTemplate.jobTemplateFilename}`);

            const builtTemplate: string = jenkinsTemplate.build(
                {
                    gluonApplicationName: application.name,
                    jobDisplayName: getApplicationJenkinsJobDisplayName(application.name, jenkinsJobTemplate.jobNamePostfix),
                    gluonBaseUrl: QMConfig.subatomic.gluon.baseUrl,
                    gluonProjectId: project.projectId,
                    bitbucketBaseUrl: QMConfig.subatomic.bitbucket.baseUrl,
                    teamDevOpsProjectId,
                    bitbucketProjectKey: project.bitbucketProject.key,
                    bitbucketRepositoryName: application.bitbucketRepository.name,
                    jenkinsfileName: jenkinsJobTemplate.expectedJenkinsfile,
                },
            );

            const createJenkinsJobResponse = await this.jenkinsService.createJenkinsJob(
                jenkinsHost,
                token,
                project.name,
                application.name + jenkinsJobTemplate.jobNamePostfix,
                builtTemplate);

            if (!isSuccessCode(createJenkinsJobResponse.status)) {
                if (createJenkinsJobResponse.status === 400) {
                    logger.warn(`Multibranch job for [${application.name}] probably already created`);
                } else {
                    logger.error(`Unable to create jenkinsJob`);
                    throw new QMError("Failed to create jenkins job. Network request failed.");
                }
            }
        }
        return await success();
    }

    private async addJenkinsFiles(application: QMApplication, jenkinsDeploymentTemplates: JenkinsDeploymentJobTemplate[], bitbucketProjectKey, bitbucketRepositorySlug): Promise<HandlerResult> {

        const username = QMConfig.subatomic.bitbucket.auth.username;
        const password = QMConfig.subatomic.bitbucket.auth.password;
        const project: GitProject = await GitCommandGitProject.cloned({
                username,
                password,
            },
            new BitBucketServerRepoRef(
                QMConfig.subatomic.bitbucket.baseUrl,
                bitbucketProjectKey,
                bitbucketRepositorySlug));
        await project.setUserConfig(
            QMConfig.subatomic.bitbucket.auth.username,
            QMConfig.subatomic.bitbucket.auth.email,
        );
        for (const jenkinsDeploymentTemplate of jenkinsDeploymentTemplates) {
            try {
                await project.findFile(jenkinsDeploymentTemplate.expectedJenkinsfile);
            } catch (error) {
                logger.info("Jenkinsfile doesnt exist. Adding it!");
                const jenkinsTemplate: QMFileTemplate = new QMFileTemplate(getPathFromJenkinsfileName(jenkinsDeploymentTemplate.sourceJenkinsfile));
                await project.addFile(jenkinsDeploymentTemplate.expectedJenkinsfile,
                    jenkinsTemplate.build({
                        application,
                        sourceEnvironment: jenkinsDeploymentTemplate.sourceEnvironment,
                        deploymentEnvironment: jenkinsDeploymentTemplate.deploymentEnvironment,
                    }));
            }

            await project.commit(`Added Jenkinsfile ${jenkinsDeploymentTemplate.expectedJenkinsfile}`);
        }

        try {
            await project.push();
        } catch (error) {
            logger.debug(`Error pushing Jenkins files to repository`);
            throw new GitError(error.message);
        }

        return await success();
    }

}
