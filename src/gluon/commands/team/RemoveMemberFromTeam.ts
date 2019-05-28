import {
    HandlerContext,
    HandlerResult,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {RemoveMemberFromTeamTask} from "../../tasks/team/RemoveMemberFromTeamTask";
import {MemberRole} from "../../util/member/Members";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Remove a member from a team", atomistIntent(CommandIntent.RemoveMemberFromTeam))
@Tags("subatomic", "team", "member")
export class RemoveMemberFromTeam extends RecursiveParameterRequestCommand implements GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @MappedParameter(MappedParameters.SlackChannel)
    public channelId: string;

    @Parameter({
        description: "slack name (@User.Name) of the member to remove from a team",
        displayable: false,
    })
    public slackName: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team you would like to remove a member from",
    })
    public teamName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Removing member from team started:`,
                new ResponderMessageClient(ctx));
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);
            taskRunner.addTask(new RemoveMemberFromTeamTask(this.slackName, this.screenName, this.teamName, MemberRole.member));
            await taskRunner.execute(ctx);
            this.succeedCommand();
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
