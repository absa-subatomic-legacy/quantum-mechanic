import {
    HandlerContext,
    HandlerResult,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {AddMemberToTeamTask} from "../../tasks/team/AddMemberToTeamTask";
import {MemberRole} from "../../util/member/Members";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Add a member as an owner to a team", QMConfig.subatomic.commandPrefix + " add team owner")
@Tags("subatomic", "member", "team")
export class AddOwnerToTeam extends RecursiveParameterRequestCommand implements GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @MappedParameter(MappedParameters.SlackChannel)
    public channelId: string;

    @Parameter({
        description: "slack name (@User.Name) of the member to make an owner",
        displayable: false,
    })
    public slackName: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team you would like to add a owner to",
    })
    public teamName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Adding member to team started:`,
                new ResponderMessageClient(ctx));

            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            taskRunner.addTask(new AddMemberToTeamTask(this.slackName, this.screenName, this.teamName, MemberRole.owner));

            await taskRunner.execute(ctx);
            this.succeedCommand();
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
