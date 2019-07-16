import {
    addressEvent,
    HandlerContext,
    HandlerResult,
    success,
} from "@atomist/automation-client";
import {CommandHandler, Tags} from "@atomist/automation-client/lib/decorators";
import {
    SimpleQMMessageClient} from "../../../context/QMMessageClient";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {PackageConfigurationRequestedEvent} from "../../events/packages/package-configuration-request/PackageConfigurationRequestedEvent";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
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
    ImageNameParam,
    ImageNameSetter,
    ImageStreamTagParam,
    ImageTagSetter,
    OpenShiftTemplateParam,
    OpenshiftTemplateSetter,
} from "../../util/recursiveparam/OpenshiftParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    } from "../../util/shared/Error";
import {GluonToEvent} from "../../util/transform/GluonToEvent";
import {QMProject} from "../../util/transform/types/gluon/Project";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Configure an existing application/library", atomistIntent(CommandIntent.ConfigurePackage))
@Tags("subatomic", "package")
export class ConfigurePackage extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter,
        JenkinsfileNameSetter, OpenshiftTemplateSetter, ImageNameSetter, ImageTagSetter {

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

    @ImageNameParam({
        callOrder: 4,
        description: "Please select the base image for the s2i build",
    })
    public imageName: string;

    @ImageStreamTagParam({
        callOrder: 5,
        description: "Please select the base image tag for the s2i build",
    })
    public imageTag: string;

    @OpenShiftTemplateParam({
        callOrder: 6,
        selectionMessage: "Please select the correct openshift template for your package",
    })
    public openshiftTemplate: string;

    @JenkinsFileParam({
        callOrder: 7,
        selectionMessage: "Please select the correct jenkinsfile for your package",
    })
    public jenkinsfileName: string;

    public buildEnvironmentVariables: { [key: string]: string } = {};

    public deploymentEnvironmentVariables: { [key: string]: string } = {};

    constructor(public gluonService = new GluonService(),
                public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        const messageClient: SimpleQMMessageClient = new ResponderMessageClient(ctx);
        try {
            await this.requestPackageConfiguration(ctx);
            this.succeedCommand();
            return await messageClient.send("Requesting package configuration...");
        } catch (error) {
            this.failCommand();
            return await handleQMError(messageClient, error);
        }
    }

    private async requestPackageConfiguration(ctx: HandlerContext): Promise<HandlerResult> {

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const application = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName);

        const member = await this.gluonService.members.gluonMemberFromSlackUserId(this.slackUserId);

        const configurePackageRequest: PackageConfigurationRequestedEvent = {
            project: GluonToEvent.project(project),
            application: GluonToEvent.application(application),
            actionedBy: GluonToEvent.member(member),
            s2iImage: {imageName: this.imageName, imageTag: this.imageTag},
            jenkinsfileName: this.jenkinsfileName,
            openshiftTemplate: this.openshiftTemplate,
            buildEnvironmentVariables: GluonToEvent.keyValueList(this.buildEnvironmentVariables),
            deploymentEnvironmentVariables: GluonToEvent.keyValueList(this.deploymentEnvironmentVariables),
        };

        await ctx.messageClient.send(configurePackageRequest, addressEvent("PackageConfigurationRequestedEvent"));

        return success();
    }
}
