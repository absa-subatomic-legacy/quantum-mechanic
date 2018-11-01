import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {QMTemplate} from "../../../template/QMTemplate";
import {KickOffJenkinsBuild} from "../../commands/jenkins/JenkinsBuild";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    addJenkinsFile,
    JenkinsJobTemplate,
    NonProdDefaultJenkinsJobTemplate,
} from "../../util/jenkins/JenkinsFiles";
import {ApplicationType} from "../../util/packages/Applications";
import {QMProject} from "../../util/project/Project";
import {ParameterDisplayType} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {QMError} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails, QMTeamBase} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigurePackageInJenkins extends Task {

    private readonly TASK_ADD_JENKINS_FILE = "AddJenkinsfile";
    private readonly TASK_CREATE_JENKINS_JOB = "CreateJenkinsJob";

    constructor(private application: QMApplication,
                private project: QMProject,
                private jenkinsFile: string,
                private jenkinsJobTemplate: JenkinsJobTemplate = NonProdDefaultJenkinsJobTemplate,
                private successMessage?: SlackMessage,
                private ocService = new OCService(),
                private jenkinsService = new JenkinsService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_ADD_JENKINS_FILE, "Add Jenkinsfile");
        this.taskListMessage.addTask(this.TASK_CREATE_JENKINS_JOB, "Create Jenkins Job");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        await this.ocService.login();

        await addJenkinsFile(
            this.jenkinsFile,
            this.project.bitbucketProject.key,
            this.application.bitbucketRepository.slug,
            this.jenkinsJobTemplate.expectedJenkinsfile,
        );

        await this.taskListMessage.succeedTask(this.TASK_ADD_JENKINS_FILE);

        const devopsDetails = getDevOpsEnvironmentDetails(this.project.owningTeam.name);

        await this.createJenkinsJob(
            devopsDetails.openshiftProjectId,
            this.project,
            this.application,
            this.jenkinsJobTemplate);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_JENKINS_JOB);

        logger.info(`PackageConfigured successfully`);

        let applicationType = ApplicationType.LIBRARY;
        if (this.application.applicationType === ApplicationType.DEPLOYABLE.toString()) {
            applicationType = ApplicationType.DEPLOYABLE;
        }

        await this.sendPackageProvisionedMessage(
            ctx,
            this.application.name,
            this.project.name,
            [this.project.owningTeam],
            applicationType);

        return true;
    }

    private async createJenkinsJob(teamDevOpsProjectId: string,
                                   project: QMProject,
                                   application: QMApplication,
                                   jenkinsJobTemplate: JenkinsJobTemplate): Promise<HandlerResult> {
        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);
        const jenkinsHost = await this.ocService.getJenkinsHost(teamDevOpsProjectId);
        logger.debug(`Using Jenkins Route host [${jenkinsHost.output}] to add Bitbucket credentials`);

        const jenkinsTemplate: QMTemplate = new QMTemplate(`resources/templates/jenkins/${jenkinsJobTemplate.templateFilename}`);
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
            jenkinsHost.output,
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

    private async sendPackageProvisionedMessage(ctx: HandlerContext, applicationName: string, projectName: string, associatedTeams: QMTeamBase[], applicationType: ApplicationType) {

        let returnableSuccessMessage = this.getDefaultSuccessMessage(applicationName, projectName, applicationType);

        if (!_.isEmpty(this.successMessage)) {
            returnableSuccessMessage = this.successMessage;
        }

        return await ctx.messageClient.addressChannels(returnableSuccessMessage, associatedTeams.map(team =>
            team.slack.teamChannel));
    }

    private getDefaultSuccessMessage(applicationName: string, projectName: string, applicationType: ApplicationType): SlackMessage {
        let packageTypeString = "application";
        if (applicationType === ApplicationType.LIBRARY) {
            packageTypeString = "library";
        }

        return {
            text: `Your ${packageTypeString} *${applicationName}*, in project *${projectName}*, has been provisioned successfully ` +
                "and is ready to build/deploy",
            attachments: [{
                fallback: `Your ${packageTypeString} has been provisioned successfully`,
                footer: `For more information, please read the ${this.docs() + "#jenkins-build"}`,
                text: `
You can kick off the build pipeline for your ${packageTypeString} by clicking the button below or pushing changes to your ${packageTypeString}'s repository`,
                mrkdwn_in: ["text"],
                actions: [
                    buttonForCommand(
                        {
                            text: "Start build",
                            style: "primary",
                        },
                        new KickOffJenkinsBuild(),
                        {
                            projectName,
                            applicationName,
                            displayResultMenu: ParameterDisplayType.hide,
                        }),
                ],
            }],
        };
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference`,
            "documentation")}`;
    }

}
