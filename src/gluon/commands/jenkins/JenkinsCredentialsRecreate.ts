import {
    HandlerContext,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {GluonService} from "../../services/gluon/GluonService";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {RecreateJenkinsDevOpsCredentials} from "../../tasks/team/RecreateJenkinsDevOpsCredentials";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    ChannelMessageClient,
    handleQMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Recreate the Jenkins Bitbucket Credentials", atomistIntent(CommandIntent.JenkinsCredentialsRecreate))
@Tags("subatomic", "bitbucket", "jenkins")
export class JenkinsCredentialsRecreate extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackUser)
    public slackName: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select the team which contains the owning project of the jenkins you would like to reconfigure",
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            const team: QMTeam = await this.gluonService.teams.gluonTeamByName(this.teamName);

            const messageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Recreating jenkins credentials for the *${this.teamName}* DevOps environment:`,
                messageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            taskRunner.addTask(new RecreateJenkinsDevOpsCredentials(team.name));

            await taskRunner.execute(ctx);

            this.succeedCommand();
            return await ctx.messageClient.respond({
                text: `🚀 Successfully created the Jenkins Credentials for the *${this.teamName}* DevOps.`,
            });
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

}
