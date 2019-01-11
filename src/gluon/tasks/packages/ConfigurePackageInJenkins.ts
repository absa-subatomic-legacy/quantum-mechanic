import {
    BitBucketServerRepoRef,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {GitCommandGitProject} from "@atomist/automation-client/lib/project/git/GitCommandGitProject";
import {GitProject} from "@atomist/automation-client/lib/project/git/GitProject";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {QMFileTemplate} from "../../../template/QMTemplate";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    JenkinsJobTemplate,
    NonProdDefaultJenkinsJobTemplate,
} from "../../util/jenkins/JenkinsJobTemplates";
import {QMProject} from "../../util/project/Project";
import {GitError, QMError} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigurePackageInJenkins extends Task {

    private readonly JENKINSFILE_EXISTS_FLAG = "JENKINS_FILE_EXISTS";
    private readonly JENKINSFILE_FOLDER = "resources/templates/jenkins/jenkinsfile-repo/";
    private readonly JENKINSFILE_EXTENSION = ".groovy";

    private readonly TASK_ADD_JENKINS_FILE = "AddJenkinsfile";
    private readonly TASK_CREATE_JENKINS_JOB = "CreateJenkinsJob";

    constructor(private application: QMApplication,
                private project: QMProject,
                private jenkinsFile: string = "",
                private jenkinsJobTemplate: JenkinsJobTemplate = NonProdDefaultJenkinsJobTemplate,
                private ocService = new OCService(),
                private gluonService = new GluonService(),
                private jenkinsService = new JenkinsService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        if (!_.isEmpty(this.jenkinsFile)) {
            this.taskListMessage.addTask(this.TASK_ADD_JENKINS_FILE, "Add Jenkinsfile");
        }
        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_JOB, "Create Jenkins Job");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.project.name);
        const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(project.owningTeam.teamId);
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd);

        if (!_.isEmpty(this.jenkinsFile)) {
            await this.addJenkinsFile(
                this.jenkinsFile,
                this.project.bitbucketProject.key,
                this.application.bitbucketRepository.slug,
                this.jenkinsJobTemplate.expectedJenkinsfile,
            );
            await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_FILE);
        }

        const devopsDetails = getDevOpsEnvironmentDetails(this.project.owningTeam.name);

        await this.createJenkinsJob(
            devopsDetails.openshiftProjectId,
            this.project,
            this.application,
            this.jenkinsJobTemplate);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_JOB);

        logger.info(`PackageConfigured successfully`);

        return true;
    }

    private async createJenkinsJob(teamDevOpsProjectId: string,
                                   project: QMProject,
                                   application: QMApplication,
                                   jenkinsJobTemplate: JenkinsJobTemplate): Promise<HandlerResult> {
        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);
        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);
        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add Bitbucket credentials`);

        const jenkinsTemplate: QMFileTemplate = new QMFileTemplate(`resources/templates/jenkins/${jenkinsJobTemplate.templateFilename}`);
        const builtTemplate: string = jenkinsTemplate.build(
            {
                gluonApplicationName: application.name,
                gluonBaseUrl: QMConfig.subatomic.gluon.baseUrl,
                gluonProjectId: project.projectId,
                bitbucketBaseUrl: QMConfig.subatomic.bitbucket.baseUrl,
                teamDevOpsProjectId,
                bitbucketProjectKey: project.bitbucketProject.key,
                bitbucketRepositoryName: application.bitbucketRepository.name,
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
        return await success();
    }

    private async addJenkinsFile(jenkinsfileName, bitbucketProjectKey, bitbucketRepositorySlug, destinationJenkinsfileName: string = "Jenkinsfile"): Promise<HandlerResult> {

        if (jenkinsfileName !== this.JENKINSFILE_EXISTS_FLAG) {
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
            try {
                await project.findFile(destinationJenkinsfileName);
            } catch (error) {
                logger.info("Jenkinsfile doesnt exist. Adding it!");
                const jenkinsTemplate: QMFileTemplate = new QMFileTemplate(this.getPathFromJenkinsfileName(jenkinsfileName as string));
                await project.addFile(destinationJenkinsfileName,
                    jenkinsTemplate.build({
                        devDeploymentEnvironments: this.project.devDeploymentPipeline.environments,
                        releaseDeploymentEnvironments: this.project.releaseDeploymentPipelines[0].environments,
                    }));
            }

            const clean = await project.isClean();
            logger.debug(`Jenkinsfile has been added: ${clean}`);

            if (!clean) {
                await project.setUserConfig(
                    QMConfig.subatomic.bitbucket.auth.username,
                    QMConfig.subatomic.bitbucket.auth.email,
                );
                await project.commit(`Added Jenkinsfile`);
                try {
                    await project.push();
                } catch (error) {
                    logger.debug(`Error pushing Jenkins file to repository`);
                    throw new GitError(error.message);
                }
            } else {
                logger.debug("Jenkinsfile already exists");
            }
        }

        return await success();
    }

    private getPathFromJenkinsfileName(jenkinsfileName: string): string {
        return this.JENKINSFILE_FOLDER + jenkinsfileName + this.JENKINSFILE_EXTENSION;
    }

}
