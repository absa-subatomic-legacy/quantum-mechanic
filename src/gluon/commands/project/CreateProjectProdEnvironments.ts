import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {
    DeploymentPipelineIdParam,
    DeploymentPipelineIdSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {QMProject} from "../../util/transform/types/gluon/Project";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Create the OpenShift production environments for a project", atomistIntent(CommandIntent.CreateProjectProdEnvironments))
@Tags("subatomic", "project", "other")
export class CreateProjectProdEnvironments extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, DeploymentPipelineIdSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to provision the production environments for",
        forceSet: false,
    })
    public teamName: string = null;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the projects you wish to provision the production environments for",
    })
    public projectName: string = null;

    @DeploymentPipelineIdParam({
        callOrder: 2,
        selectionMessage: "Please select the deployment pipeline you wish to take to prod",
    })
    public deploymentPipelineId;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Creating project OpenShift production environments...");

        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `Requesting production environments's for project *${this.projectName}*`,
            }, destination);

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            const member = await this.gluonService.members.gluonMemberFromSlackUserId(this.slackUserId);

            await this.gluonService.prod.project.createProjectProdRequest(member.memberId, project.projectId, this.deploymentPipelineId);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
