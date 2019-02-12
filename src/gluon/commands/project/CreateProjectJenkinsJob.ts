import {
    addressEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
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
import {
    handleQMError,
    QMMessageClient,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {isUserAMemberOfTheTeam, QMTeam} from "../../util/team/Teams";
import {GluonToEvent} from "../../util/transform/GluonToEvent";

@CommandHandler("Creates a jenkins build job for a given project", QMConfig.subatomic.commandPrefix + " project request jenkins job")
@Tags("subatomic", "project", "jenkins", "other")
export class CreateProjectJenkinsJob extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to provision the environments for",
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

        const messageClient: QMMessageClient = new ResponderMessageClient(ctx);

        try {
            await messageClient.send({
                text: `Requesting project *${this.projectName}* jenkins job creation...`,
            });

            const member: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const team: QMTeam = await this.gluonService.teams.gluonTeamByName(this.teamName);

            if (!isUserAMemberOfTheTeam(member, team)) {
                this.failCommand();
                return await messageClient.send(this.teamMembershipMessages.notAMemberOfTheTeam());
            }

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            await this.requestJenkinsJob(ctx, project, member, team);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await handleQMError(messageClient, error);
        }
    }

    private async requestJenkinsJob(ctx: HandlerContext, project: QMProject, member: QMMemberBase, owningTeam: QMTeam) {
        const event = {
            project,
            requestedBy: member,
            owningTeam: GluonToEvent.team(owningTeam),
        };
        return await ctx.messageClient.send(event, addressEvent("ProjectJenkinsJobRequestedEvent"));
    }

}
