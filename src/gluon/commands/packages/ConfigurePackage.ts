import {
    HandlerContext,
    HandlerResult,
    success,
} from "@atomist/automation-client";
import {CommandHandler, Tags} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {QMConfig} from "../../../config/QMConfig";
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
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Configure an existing application/library", QMConfig.subatomic.commandPrefix + " configure custom package")
@Tags("subatomic", "package")
export class ConfigurePackage extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter, JenkinsfileNameSetter, OpenshiftTemplateSetter, ImageNameSetter {

    @GluonApplicationNameParam({
        callOrder: 2,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @ImageNameFromDevOpsParam({
        callOrder: 3,
        description: "Please select the base image for the s2i build",
    })
    public imageName: string;

    @OpenShiftTemplateParam({
        callOrder: 4,
        selectionMessage: "Please select the correct openshift template for your package",
    })
    public openshiftTemplate: string;

    @JenkinsFileParam({
        callOrder: 5,
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
            const result = await this.configurePackage(ctx);
            this.succeedCommand();
            return result;
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

}
