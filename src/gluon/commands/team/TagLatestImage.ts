import {HandlerContext, logger, Tags} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {inspect} from "util";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {OpenshiftResource} from "../../../openshift/api/resources/OpenshiftResource";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {getProjectDevOpsId} from "../../util/project/Project";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {ImageNameParam} from "../../util/recursiveparam/OpenshiftParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Tag an individual subatomic image to a devops environment ", atomistIntent(CommandIntent.TagLatestImage))
@Tags("subatomic", "devops", "team", "images")
export class TagLatestImage extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select the team you would like to tag the image to",
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    @ImageNameParam({
        callOrder: 2,
        selectionMessage: "Please select the image you would like tagged to your DevOps environment",
    })
    public imageName: string;

    constructor(public gluonService = new GluonService(), private ocService = new OCService()) {
        super();
    }

    protected runCommand(ctx: HandlerContext) {
        try {
            return this.tagImage(
                ctx,
            );
        } catch (error) {
            return handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async tagImage(ctx: HandlerContext) {
        const messageId = uuid();
        const devopsEnvironment = getProjectDevOpsId(this.teamName);
        await ctx.messageClient.respond(`Tagging selected image to devops environment *${devopsEnvironment}*...`, {id: messageId});
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);
        const project: OpenshiftResource = await this.ocService.findProject(devopsEnvironment);
        if (project === null) {
            this.failCommand();
            throw new QMError(`No devops environment for team ${this.teamName} has been provisioned yet.`);
        }
        try {
            await this.ocService.tagSubatomicImageToNamespace(this.imageName, devopsEnvironment);
        } catch (error) {
            this.failCommand();
            logger.error(`Failed to tag selected image to project ${devopsEnvironment}. Error: ${inspect(error)}`);
            throw new QMError("Image tagging failed. Please contact your system administrator for assistance.");
        }
        this.succeedCommand();
        return ctx.messageClient.respond(`Image successfully tagged to devops environment *${devopsEnvironment}*.`, {id: messageId});
    }
}
