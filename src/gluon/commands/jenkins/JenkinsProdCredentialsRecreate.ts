import {HandlerContext, HandlerResult, Tags} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {AddJenkinsToProdEnvironment} from "../../tasks/team/AddJenkinsToProdEnvironment";
import {assertApplicationProdCanBeRequested} from "../../util/prod/ProdAssertions";
import {
    getPipelineOpenShiftNamespacesForOpenShiftCluster,
    getProjectDeploymentPipelineFromPipelineId,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {
    DeploymentPipelineIdParam,
    DeploymentPipelineIdSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    ChannelMessageClient,
    handleQMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Recreate the production jenkins credentials for a project pipeline", atomistIntent(CommandIntent.JenkinsProdCredentialsRecreate))
@Tags("subatomic", "project")
export class JenkinsProdCredentialsRecreate extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, DeploymentPipelineIdSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure jenkins for",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the project you wish to configure jenkins for",
    })
    public projectName: string;

    @DeploymentPipelineIdParam({
        callOrder: 2,
        selectionMessage: "Please select the deployment pipeline you wish to configure jenkins for",
    })
    public deploymentPipelineId: string;

    constructor(public gluonService = new GluonService(), public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {

        try {
            await assertApplicationProdCanBeRequested(this.projectName, this.deploymentPipelineId, this.gluonService);

            const team: QMTeam = await this.gluonService.teams.gluonTeamByName(this.teamName);

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            const owningTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

            const deploymentPipeline = getProjectDeploymentPipelineFromPipelineId(project, this.deploymentPipelineId);

            const messageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Recreating production jenkins credentials for the *${this.teamName}* team's *${this.projectName}* project using the *${deploymentPipeline.name}* pipeline:`,
                messageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            for (const prodOpenshift of QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftProd) {
                // Get details of all the prod project namespaces we need to operate on.
                const environmentsForCreation: OpenShiftProjectNamespace[] = getPipelineOpenShiftNamespacesForOpenShiftCluster(owningTenant.name, project, deploymentPipeline, prodOpenshift);

                taskRunner.addTask(new AddJenkinsToProdEnvironment({
                    team,
                    project,
                }, environmentsForCreation, prodOpenshift));
            }

            await taskRunner.execute(ctx);

            this.succeedCommand();
            return await ctx.messageClient.respond({
                text: `🚀 Successfully created the Jenkins production Credentials!`,
            });
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
