import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {QMFileTemplate} from "../../../template/QMTemplate";
import {
    BitbucketFileService,
    SourceControlledFileRequest,
} from "../../services/bitbucket/BitbucketFileService";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {ConfigurePackageInJenkinsService} from "../../services/packages/ConfigurePackageInJenkinsService";
import {
    getApplicationJenkinsJobDisplayName,
    getPathFromJenkinsfileName,
    getSubatomicJenkinsServiceAccountName,
} from "../../util/jenkins/Jenkins";
import {
    EmptyJenkinsJobTemplate,
    JenkinsJobTemplate,
} from "../../util/jenkins/JenkinsJobTemplates";
import {QMProject} from "../../util/project/Project";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigurePackagePipelineInJenkins extends Task {

    private readonly JENKINSFILE_EXISTS_FLAG = "JENKINS_FILE_EXISTS";

    private readonly TASK_ADD_JENKINS_FILE = TaskListMessage.createUniqueTaskName("AddJenkinsfile");
    private readonly TASK_CREATE_JENKINS_JOB = TaskListMessage.createUniqueTaskName("CreateJenkinsJob");

    constructor(private application: QMApplication,
                private project: QMProject,
                private jenkinsJobTemplate: JenkinsJobTemplate = EmptyJenkinsJobTemplate,
                private ocService = new OCService(),
                private gluonService = new GluonService(),
                private bitbucketFileService = new BitbucketFileService(),
                private configurePackageInJenkinsService = new ConfigurePackageInJenkinsService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        if (!_.isEmpty(this.jenkinsJobTemplate.sourceJenkinsfile)) {
            this.taskListMessage.addTask(this.TASK_ADD_JENKINS_FILE, "Add Jenkinsfile");
        }
        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_JOB, "Create Jenkins Job");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(this.project.owningTeam.teamId);
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd);

        if (!_.isEmpty(this.jenkinsJobTemplate.sourceJenkinsfile)) {
            await this.addJenkinsFile(
                this.jenkinsJobTemplate.sourceJenkinsfile,
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
                bitbucketRepositorySlug: application.bitbucketRepository.slug,
                jenkinsfileName: jenkinsJobTemplate.expectedJenkinsfile,
            },
        );

        const token = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), teamDevOpsProjectId);
        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        return await this.configurePackageInJenkinsService.createJenkinsJobAndAddToView(
            jenkinsHost,
            token,
            project.name,
            application.name,
            getApplicationJenkinsJobDisplayName(application.name, jenkinsJobTemplate.jobNamePostfix),
            builtTemplate);

    }

    private async addJenkinsFile(jenkinsfileName: string, bitbucketProjectKey, bitbucketRepositorySlug, destinationJenkinsfileName: string = "Jenkinsfile"): Promise<HandlerResult> {

        if (jenkinsfileName !== this.JENKINSFILE_EXISTS_FLAG) {
            const jenkinsfilesToAddToRepository: SourceControlledFileRequest[] = [];

            const jenkinsTemplate: QMFileTemplate = new QMFileTemplate(getPathFromJenkinsfileName(jenkinsfileName));
            const content = jenkinsTemplate.build({
                devDeploymentEnvironments: this.project.devDeploymentPipeline.environments,
                releaseDeploymentEnvironments: this.project.releaseDeploymentPipelines[0].environments,
            });
            const commitMessage = `Added ${destinationJenkinsfileName}`;

            jenkinsfilesToAddToRepository.push(
                {
                    filename: destinationJenkinsfileName,
                    content,
                    commitMessage,
                },
            );
            await this.bitbucketFileService.addFilesToBitbucketRepository(bitbucketProjectKey, bitbucketRepositorySlug, jenkinsfilesToAddToRepository);
        }

        return await success();
    }

}
