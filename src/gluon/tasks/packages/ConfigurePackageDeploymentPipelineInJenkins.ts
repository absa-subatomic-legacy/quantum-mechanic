import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {QMFileTemplate} from "../../../template/QMTemplate";
import {
    BitbucketFileService,
    SourceControlledFileRequest,
} from "../../services/bitbucket/BitbucketFileService";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    ConfigurePackageInJenkinsService,
    JenkinsJobDefinition,
} from "../../services/packages/ConfigurePackageInJenkinsService";
import {
    getApplicationJenkinsJobDisplayName,
    getPathFromJenkinsfileName,
    getSubatomicJenkinsServiceAccountName,
} from "../../util/jenkins/Jenkins";
import {
    JenkinsDeploymentJobTemplate,
    JenkinsJobTemplate,
} from "../../util/jenkins/JenkinsJobTemplates";
import {QMProject} from "../../util/project/Project";
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
                private jenkinsService = new JenkinsService(),
                private bitbucketFileService = new BitbucketFileService(),
                private configurePackageInJenkinsService = new ConfigurePackageInJenkinsService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_FILE, "Add Jenkinsfiles");

        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_JOB, "Create Jenkins Jobs");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(this.project.owningTeam.teamId);
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd);

        const devopsDetails = getDevOpsEnvironmentDetails(this.project.owningTeam.name);

        await this.addJenkinsFiles(
            devopsDetails.openshiftProjectId,
            this.application,
            this.jenkinsDeploymentJobConfigs,
            this.project.bitbucketProject.key,
            this.application.bitbucketRepository.slug,
        );
        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_FILE);

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
                                    jenkinsJobTemplates: JenkinsJobTemplate[]): Promise<HandlerResult> {
        const token = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), teamDevOpsProjectId);
        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add Bitbucket credentials`);

        const jenkinsJobDefinitions: JenkinsJobDefinition[] = [];

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
                    bitbucketRepositorySlug: application.bitbucketRepository.slug,
                    jenkinsfileName: jenkinsJobTemplate.expectedJenkinsfile,
                },
            );

            jenkinsJobDefinitions.push({
                jenkinsJobDisplayName: getApplicationJenkinsJobDisplayName(application.name, jenkinsJobTemplate.jobNamePostfix),
                jenkinsJobXmlDefinition: builtTemplate,
            });
        }

        return await this.configurePackageInJenkinsService.createMultipleJenkinsJobsAndAddToView(jenkinsHost, token, project.name, application.name, jenkinsJobDefinitions);
    }

    private async addJenkinsFiles(teamDevOpsProjectId: string, application: QMApplication, jenkinsDeploymentTemplates: JenkinsDeploymentJobTemplate[], bitbucketProjectKey, bitbucketRepositorySlug): Promise<HandlerResult> {

        const jenkinsfilesToAddToRepository: SourceControlledFileRequest[] = [];

        for (const jenkinsDeploymentTemplate of jenkinsDeploymentTemplates) {

            const jenkinsTemplate: QMFileTemplate = new QMFileTemplate(getPathFromJenkinsfileName(jenkinsDeploymentTemplate.sourceJenkinsfile));
            const content = jenkinsTemplate.build({
                teamDevOpsProjectId,
                application,
                sourceEnvironment: jenkinsDeploymentTemplate.sourceEnvironment,
                deploymentEnvironments: jenkinsDeploymentTemplate.deploymentEnvironments,
            });
            const commitMessage = `Added ${jenkinsDeploymentTemplate.expectedJenkinsfile}`;

            jenkinsfilesToAddToRepository.push(
                {
                    filename: jenkinsDeploymentTemplate.expectedJenkinsfile,
                    content,
                    commitMessage,
                },
            );
        }

        await this.bitbucketFileService.addFilesToBitbucketRepository(bitbucketProjectKey, bitbucketRepositorySlug, jenkinsfilesToAddToRepository);

        return await success();
    }

}
