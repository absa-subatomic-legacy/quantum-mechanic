import {
    buttonForCommand,
    HandlerContext,
    HandlerResult,
    SlackDestination,
    success,
} from "@atomist/automation-client";
import {CommandHandler, Tags} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {ConfigurePackageInJenkins} from "../../tasks/packages/ConfigurePackageInJenkins";
import {ConfigurePackageInOpenshift} from "../../tasks/packages/ConfigurePackageInOpenshift";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {ApplicationType} from "../../util/packages/Applications";
import {QMProject} from "../../util/project/Project";
import {
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    JenkinsfileNameSetter,
    JenkinsFileParam,
} from "../../util/recursiveparam/JenkinsParameterSetters";
import {
    ImageNameFromDevOpsParam,
    ImageNameSetter,
    OpenShiftTemplateParam,
    OpenshiftTemplateSetter,
} from "../../util/recursiveparam/OpenshiftParameterSetters";
import {
    ParameterDisplayType,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {KickOffJenkinsBuild} from "../jenkins/JenkinsBuild";

@CommandHandler("Configure an existing application/library", QMConfig.subatomic.commandPrefix + " configure custom package")
@Tags("subatomic", "package")
export class ConfigurePackage extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter, JenkinsfileNameSetter, OpenshiftTemplateSetter, ImageNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @GluonApplicationNameParam({
        callOrder: 2,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 3,
        selectionMessage: "",
    })
    public openShiftCloud: string;

    @ImageNameFromDevOpsParam({
        callOrder: 4,
        description: "Please select the base image for the s2i build",
    })
    public imageName: string;

    @OpenShiftTemplateParam({
        callOrder: 5,
        selectionMessage: "Please select the correct openshift template for your package",
    })
    public openshiftTemplate: string;

    @JenkinsFileParam({
        callOrder: 6,
        selectionMessage: "Please select the correct jenkinsfile for your package",
    })
    public jenkinsfileName: string;

    public buildEnvironmentVariables: { [key: string]: string } = {};

    constructor(public gluonService = new GluonService(),
                public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: "Preparing to configure your package...",
            }, destination);

            const application: QMApplication = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName, false);

            await this.configurePackage(ctx);

            this.succeedCommand();
            return this.sendPackageProvisionedMessage(ctx, this.applicationName, this.projectName, destination, ApplicationType[application.applicationType]);
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async configurePackage(ctx: HandlerContext): Promise<HandlerResult> {
        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const application = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName);

        const taskListMessage = new TaskListMessage(":rocket: Configuring package...", new ResponderMessageClient(ctx));
        const taskRunner = new TaskRunner(taskListMessage);
        if (application.applicationType === ApplicationType.DEPLOYABLE.toString()) {
            taskRunner.addTask(
                new ConfigurePackageInOpenshift(
                    {
                        buildEnvironmentVariables: this.buildEnvironmentVariables,
                        openshiftTemplate: this.openshiftTemplate,
                        baseS2IImage: this.imageName,
                    },
                    {
                        teamName: this.teamName,
                        projectName: this.projectName,
                        packageName: application.name,
                        packageType: application.applicationType,
                        bitbucketRepoRemoteUrl: application.bitbucketRepository.remoteUrl,
                        owningTeamName: project.owningTeam.name,
                    }),
            );
        }

        taskRunner.addTask(
            new ConfigurePackageInJenkins(
                application,
                project,
                this.jenkinsfileName),
        );

        await taskRunner.execute(ctx);

        return success();
    }

    private async sendPackageProvisionedMessage(ctx: HandlerContext, applicationName: string, projectName: string, slackChannel: SlackDestination, applicationType: ApplicationType) {

        const returnableSuccessMessage = this.getDefaultSuccessMessage(applicationName, projectName, applicationType);

        return await ctx.messageClient.send(returnableSuccessMessage, slackChannel);
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
