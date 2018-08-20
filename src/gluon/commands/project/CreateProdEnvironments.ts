import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    success,
    Tags,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {QMTeamService} from "../../services/team/QMTeamService";
import {CreateOpenshiftProductionEnvironment} from "../../tasks/project/CreateOpenshiftProductionEnvironment";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {
    createQMProject,
    OpenshiftProjectEnvironmentRequest,
} from "../../util/project/Project";
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
import {
    ChannelMessageClient,
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {createQMTenant} from "../../util/shared/Tenants";
import {createQMTeam} from "../../util/team/Teams";

@CommandHandler("Create the OpenShift production environments for a project", QMConfig.subatomic.commandPrefix + " request project prod")
@Tags("subatomic", "openshiftNonProd", "project")
export class CreateProdEnvironments extends RecursiveParameterRequestCommand
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
        recursiveKey: CreateProdEnvironments.RecursiveKeys.projectName,
        selectionMessage: "Please select the projects you wish to provision the production environments for",
    })
    public projectName: string = null;

    @RecursiveParameter({
        recursiveKey: CreateProdEnvironments.RecursiveKeys.teamName,
        selectionMessage: "Please select a team associated with the project you wish to provision the production environments for",
        forceSet: false,
    })
    public teamName: string = null;

    constructor(public gluonService = new GluonService(), public qmTeamService = new QMTeamService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Creating project OpenShift production environments...");

        try {
            await ctx.messageClient.addressChannels({
                text: `Requesting production environments's for project *${this.projectName}*`,
            }, this.teamChannel);

            const project = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            await this.verifyUser(project);

            const qmMessageClient = this.createMessageClient(ctx, project);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Provisioning of environment's for project *${project.name}* started:`,
                qmMessageClient);

            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            const request: OpenshiftProjectEnvironmentRequest = this.createEnvironmentRequest(project);

            for (const prodOpenshift of QMConfig.subatomic.openshiftProd) {
                taskRunner.addTask(
                    new CreateOpenshiftProductionEnvironment(prodOpenshift, request),
                );
            }

            await taskRunner.execute(ctx);

            return await success();
        } catch (error) {
            return await this.handleError(ctx, error);
        }
    }

    protected configureParameterSetters() {
        this.addRecursiveSetter(CreateProdEnvironments.RecursiveKeys.teamName, setGluonTeamName);
        this.addRecursiveSetter(CreateProdEnvironments.RecursiveKeys.projectName, setGluonProjectName);
    }

    private createEnvironmentRequest(gluonProject): OpenshiftProjectEnvironmentRequest {
        const request: OpenshiftProjectEnvironmentRequest = {
            teams: [createQMTeam(gluonProject.owningTeam.name)],
            project: createQMProject(gluonProject.name),
            owningTenant: createQMTenant(gluonProject.owningTenant),
        };
        for (const team of gluonProject.teams) {
            request.teams.push(createQMTeam(team.name));
        }
        return request;
    }

    private verifyUser(gluonProject) {
        if (!this.qmTeamService.isUserMemberOfValidTeam(this.screenName, this.getAllAssociateProjectTeams(gluonProject))) {
            throw new QMError("Not a member");
        }
    }

    private getAllAssociateProjectTeams(gluonProject) {
        const teams = [gluonProject.owningTeam];
        gluonProject.teams.map(team => {
            teams.push(team);
        });
        return teams;
    }

    private createMessageClient(ctx: HandlerContext,
                                gluonProject: { owningTeam: { slack: { teamChannel: string } }, teams: Array<{ slack: { teamChannel: string } }> }) {
        const messageClient = new ChannelMessageClient(ctx);
        this.getAllAssociateProjectTeams(gluonProject).map(team => {
            messageClient.addDestination(team.slack.teamChannel);
        });
        return messageClient;
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
