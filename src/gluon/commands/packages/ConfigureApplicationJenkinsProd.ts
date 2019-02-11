import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {CommandHandler, Tags} from "@atomist/automation-client/lib/decorators";
import {SlackMessage} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {TeamMembershipMessages} from "../../messages/member/TeamMembershipMessages";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigurePackageInJenkins} from "../../tasks/packages/ConfigurePackageInJenkins";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {getDefaultProdJenkinsFileName} from "../../util/jenkins/Jenkins";
import {ProdDefaultJenkinsJobTemplate} from "../../util/jenkins/JenkinsJobTemplates";
import {QMMemberBase} from "../../util/member/Members";
import {QMProject} from "../../util/project/Project";
import {
    DeploymentPipelineIdParam,
    DeploymentPipelineIdSetter,
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMMessageClient,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {isUserAMemberOfTheTeam, QMTeam} from "../../util/team/Teams";

@CommandHandler("Add a prod deployment job to jenkins for an application", QMConfig.subatomic.commandPrefix + " configure application jenkins prod")
@Tags("subatomic", "package", "jenkins")
export class ConfigureApplicationJenkinsProd extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter, DeploymentPipelineIdSetter {

    @GluonTeamNameParam({
        callOrder: 0,
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the application you wish to deploy to prod",
    })
    public projectName: string;

    @DeploymentPipelineIdParam({
        callOrder: 2,
        selectionMessage: "Please select the deployment pipeline to configure the prod deployment for",
    })
    public deploymentPipelineId: string;

    @GluonApplicationNameParam({
        callOrder: 3,
        selectionMessage: "Please select the application you wish to deploy to prod",
    })
    public applicationName: string;

    private teamMembershipMessages: TeamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {

        logger.info(`Trying to create prod jenkins config for Team: ${this.teamName}, Project: ${this.projectName}, Application: ${this.applicationName}`);

        const messageClient: ResponderMessageClient = new ResponderMessageClient(ctx);

        try {
            const member: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const requestingTeam: QMTeam = await this.gluonService.teams.gluonTeamByName(this.teamName);

            if (!isUserAMemberOfTheTeam(member, requestingTeam)) {
                return await messageClient.send(this.teamMembershipMessages.notAMemberOfTheTeam());
            }

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            await this.gluonService.prod.project.assertProjectProdIsApproved(project.projectId, this.deploymentPipelineId);

            const application: QMApplication = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName);

            const taskListMessage: TaskListMessage = new TaskListMessage(":rocket: Configuring Application Prod Jenkins...", messageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            taskRunner.addTask(
                new ConfigurePackageInJenkins(application, project, getDefaultProdJenkinsFileName(), ProdDefaultJenkinsJobTemplate),
            );

            await taskRunner.execute(ctx);
            this.succeedCommand();
            return this.sendPackageProvisionedMessage(messageClient, this.applicationName, this.projectName);
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async sendPackageProvisionedMessage(messageClient: QMMessageClient, applicationName: string, projectName: string) {

        const returnableSuccessMessage = this.getSuccessMessage(applicationName, projectName);

        return await messageClient.send(returnableSuccessMessage);
    }

    private getSuccessMessage(applicationName: string, projectName: string): SlackMessage {

        return {
            text: `Your prod jenkins deployment for application *${applicationName}*, in project *${projectName}*, has been provisioned successfully.`,
            attachments: [{
                fallback: `Your prod deployment has been provisioned successfully`,
                text: `
You can kick off the build deployment for your application by starting it in Jenkins.`,
                mrkdwn_in: ["text"],
            }],
        };
    }

}
