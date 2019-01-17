import {
    addressEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {QMConfig} from "../../../config/QMConfig";
import {TeamMembershipMessages} from "../../messages/member/TeamMembershipMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {QMMemberBase} from "../../util/member/Members";
import {QMProject} from "../../util/project/Project";
import {
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Create the jenkins build job a project", QMConfig.subatomic.commandPrefix + " project request jenkins job")
@Tags("subatomic", "project", "jenkins", "other")
export class CreateProjectJenkinsJob extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to provision the environments for",
        forceSet: false,
    })
    public teamName: string = null;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the projects you wish to create the jenkins job for",
    })
    public projectName: string = null;

    private teamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Requesting jenkins job creation...");

        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `Requesting project *${this.projectName}* jenkins job creation...`,
            }, destination);

            const member: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            await this.requestJenkinsJob(ctx, project, member);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async requestJenkinsJob(ctx: HandlerContext, project: QMProject, member: QMMemberBase) {
        const event = {
            project,
            requestedBy: member,
        };
        return await ctx.messageClient.send(event, addressEvent("ProjectJenkinsJobRequestedEvent"));
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
