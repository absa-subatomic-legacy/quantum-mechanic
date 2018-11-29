import {HandlerContext, HandlerResult, Tags} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {PatchPackageBuildConfigImage} from "../../tasks/packages/PatchPackageBuildConfigImage";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter, GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    ImageNameFromDevOpsParam,
    ImageNameSetter,
} from "../../util/recursiveparam/OpenshiftParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Patch the s2i image used to build a package", QMConfig.subatomic.commandPrefix + " patch package s2i image")
@Tags("subatomic", "package")
export class PatchBuildConfigBaseImage extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter, ImageNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    @GluonProjectNameParam({
        callOrder: 2,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @GluonApplicationNameParam({
        callOrder: 3,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @ImageNameFromDevOpsParam({
        callOrder: 4,
        description: "Base image for s2i build",
    })
    public imageName: string;

    public buildEnvironmentVariables: { [key: string]: string } = {};

    constructor(public gluonService = new GluonService(),
                public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        const qmMessageClient = new ResponderMessageClient(ctx);
        try {
            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Patching of BuildConfig s2i image for package *${this.applicationName}* in project *${this.projectName} * started:`,
                qmMessageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);
            taskRunner.addTask(
                new PatchPackageBuildConfigImage(this.imageName, this.applicationName, this.projectName, this.teamName, QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd),
            );

            await taskRunner.execute(ctx);

            await qmMessageClient.send("Patching BuildConfig completed successfully!");
            this.succeedCommand();
        } catch (error) {
            this.failCommand();
            return await handleQMError(qmMessageClient, error);
        }
    }

}
