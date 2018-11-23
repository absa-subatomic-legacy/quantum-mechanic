import {HandlerContext, logger, Tags} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {inspect} from "util";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {getProjectDevOpsId} from "../../util/project/Project";
import {
    GluonTeamNameSetter,
    setGluonTeamName,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Tag all latest subatomic images to a devops environment ", QMConfig.subatomic.commandPrefix + " tag all images")
@Tags("subatomic", "devops", "team", "images")
export class TagAllLatestImages extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    private static RecursiveKeys = {
        teamName: "TEAM_NAME",
    };

    @RecursiveParameter({
        recursiveKey: TagAllLatestImages.RecursiveKeys.teamName,
        selectionMessage: "Please select the team you would like to tag the latest images to",
    })
    public teamName: string;

    constructor(public gluonService = new GluonService(), private ocService = new OCService()) {
        super();
    }

    protected runCommand(ctx: HandlerContext) {
        try {
            return this.tagAllImages(
                ctx,
            );
        } catch (error) {
            return handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    protected configureParameterSetters() {
        this.addRecursiveSetter(TagAllLatestImages.RecursiveKeys.teamName, setGluonTeamName);
    }

    private async tagAllImages(ctx: HandlerContext) {
        const messageId = uuid();
        const devopsEnvironment = getProjectDevOpsId(this.teamName);
        await ctx.messageClient.respond(`Tagging latest images to devops environment *${devopsEnvironment}*...`, {id: messageId});
        await this.ocService.login(QMConfig.subatomic.openshiftClouds["ab-cloud"].openshiftNonProd);
        const project = this.ocService.findProject(devopsEnvironment);
        if (project === null) {
            this.failCommand();
            throw new QMError(`No devops environment for team ${this.teamName} has been provisioned yet.`);
        }
        try {
            await this.ocService.tagAllSubatomicImageStreamsToDevOpsEnvironment(devopsEnvironment);
        } catch (error) {
            this.failCommand();
            logger.error(`Failed to tag images to project ${devopsEnvironment}. Error: ${inspect(error)}`);
            throw new QMError("Image tagging failed. Please contact your system administrator for assistance.");
        }
        this.succeedCommand();
        return ctx.messageClient.respond(`All images successfully tagged to devops environment *${devopsEnvironment}*.`, {id: messageId});
    }
}
