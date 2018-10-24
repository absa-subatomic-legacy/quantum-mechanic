import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    success,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {TeamMembershipMessages} from "../../messages/member/TeamMembershipMessages";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigureBitbucketForProject} from "../../tasks/bitbucket/ConfigureBitbucketForProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {
    GluonProjectNameSetter,
    GluonTeamNameSetter,
    setGluonProjectName,
    setGluonTeamName,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {isUserAMemberOfTheTeam} from "../../util/team/Teams";

@CommandHandler("Reconfigure Bitbucket for an existing project", QMConfig.subatomic.commandPrefix + " configure project bitbucket")
export class ConfigureBitbucketProject extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    private static RecursiveKeys = {
        teamName: "TEAM_NAME",
        projectName: "PROJECT_NAME",
    };

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @RecursiveParameter({
        recursiveKey: ConfigureBitbucketProject.RecursiveKeys.projectName,
        selectionMessage: "Please select the project you wish to configure the Bitbucket project for",
    })
    public projectName: string;

    @RecursiveParameter({
        recursiveKey: ConfigureBitbucketProject.RecursiveKeys.teamName,
        selectionMessage: "Please select a team associated with the project you wish to configure the Bitbucket project for",
        forceSet: false,
    })
    public teamName: string;

    private teamMembershipMessages: TeamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService(), public bitbucketService = new BitbucketService()) {
        super();
    }

    protected configureParameterSetters() {
        this.addRecursiveSetter(ConfigureBitbucketProject.RecursiveKeys.teamName, setGluonTeamName);
        this.addRecursiveSetter(ConfigureBitbucketProject.RecursiveKeys.projectName, setGluonProjectName);
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Team: ${this.teamName}, Project: ${this.projectName}`);

        const messageClient: ResponderMessageClient = new ResponderMessageClient(ctx);

        try {
            const member = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const team = await this.gluonService.teams.gluonTeamByName(this.teamName);

            const project = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            if (!isUserAMemberOfTheTeam(member, team)) {
                return await messageClient.send(this.teamMembershipMessages.notAMemberOfTheTeam());
            }

            const taskListMessage: TaskListMessage = new TaskListMessage(":rocket: Configuring Bitbucket Project...", messageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            taskRunner.addTask(
                new ConfigureBitbucketForProject(team, project, this.bitbucketService),
            );

            await taskRunner.execute(ctx);

            return await success();
        } catch (error) {
            return await handleQMError(messageClient, error);
        }
    }

}
