import {
    buttonForCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {SlackMessage} from "@atomist/slack-messages";
import {v4 as uuid} from "uuid";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {ConfigureJenkinsForProject} from "../../tasks/project/ConfigureJenkinsForProject";
import {CreateOpenshiftEnvironments} from "../../tasks/project/CreateOpenshiftEnvironments";
import {CreateOpenshiftResourcesInProject} from "../../tasks/project/CreateOpenshiftResourcesInProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {CreateTeamDevOpsEnvironment} from "../../tasks/team/CreateTeamDevOpsEnvironment";
import {
    getAllProjectOpenshiftNamespaces,
    OpenshiftProjectEnvironmentRequest,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
import {QMTeam} from "../../util/team/Teams";

@CommandHandler("Move openshift resources to a different cloud", QMConfig.subatomic.commandPrefix + " team cloud migrate")
@Tags("subatomic", "team", "other")
export class MigrateTeamCloud extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public approval: ApprovalEnum = ApprovalEnum.CONFIRM;

    @Parameter({
        required: false,
        displayable: false,
    })
    public correlationId: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public openShiftResourcesJSON: string;

    constructor(public gluonService = new GluonService(), public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const team: QMTeam = await this.gluonService.teams.gluonTeamByName(this.teamName);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            if (this.approval === ApprovalEnum.CONFIRM) {
                this.correlationId = uuid();
                const message = this.confirmMigrationRequest(this);

                return await qmMessageClient.send(message, {id: this.correlationId});
            } else if (this.approval === ApprovalEnum.APPROVED) {

                const taskRunner = await this.createMigrateTeamToCloudTasks(qmMessageClient, team);

                await taskRunner.execute(ctx);

                this.succeedCommand();

                return success();
            } else if (this.approval === ApprovalEnum.REJECTED) {
                return await qmMessageClient.send(this.getConfirmationResultMesssage(this.approval), {id: this.correlationId});
            }

        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private getConfirmationResultMesssage(result: ApprovalEnum) {
        const message = {
            text: `*Migration request status:*`,
            attachments: [],
        };

        if (result === ApprovalEnum.APPROVED) {
            message.attachments.push({
                text: `*Confirmed*`,
                fallback: "*Confirmed*",
                color: QMColours.stdGreenyMcAppleStroodle.hex,
            });
        } else if (result === ApprovalEnum.REJECTED) {
            message.attachments.push({
                text: `*Cancelled*`,
                fallback: "*Cancelled*",
                color: QMColours.stdReddyMcRedFace.hex,
            });
        }

        return message;
    }

    private async createMigrateTeamToCloudTasks(qmMessageClient: QMMessageClient, team: QMTeam) {
        const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Migrating Team to cloud *${this.openShiftCloud}* started:`,
            qmMessageClient);
        const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

        taskRunner.addTask(
            new CreateTeamDevOpsEnvironment({team}, QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd),
        );

        const projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(team.name, false);
        for (const project of projects) {
            await this.addCreateProjectEnvironmentsTasks(taskRunner, team, project);
        }

        return taskRunner;
    }

    private async addCreateProjectEnvironmentsTasks(taskRunner: TaskRunner, team: QMTeam, project: QMProject) {

        const tenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);

        const environmentsForCreation: OpenShiftProjectNamespace[] = getAllProjectOpenshiftNamespaces(tenant, project);

        const createOpenshiftEnvironmentsDetails: OpenshiftProjectEnvironmentRequest = {
            project,
            owningTenant: tenant,
            teams: [team],
        };

        const openShiftNonProd: OpenShiftConfig = QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd;

        taskRunner.addTask(
            new CreateOpenshiftEnvironments(createOpenshiftEnvironmentsDetails, environmentsForCreation, openShiftNonProd),
        ).addTask(
            new ConfigureJenkinsForProject(createOpenshiftEnvironmentsDetails, project.devDeploymentPipeline, project.releaseDeploymentPipelines, openShiftNonProd),
        );

        const resourceKindsForExport = ["Service", "DeploymentConfig", "ImageStream", "Route", "PersistentVolumeClaim", "Secret", "ConfigMap"];

        for (const environment of environmentsForCreation) {
            const allResources = await this.ocService.exportAllResources(environment.namespace, resourceKindsForExport);
            taskRunner.addTask(
                new CreateOpenshiftResourcesInProject([environment], environment.namespace, allResources, openShiftNonProd),
            );
        }
    }

    private confirmMigrationRequest(migrationRequestCommand: MigrateTeamCloud): SlackMessage {

        const text: string = `By clicking Approve below you confirm that you sign off on the team and all associated resources being moved to the selected cloud.`;

        return {
            text,
            attachments: [{
                fallback: "Please confirm that the above resources should be moved to Prod",
                footer: `For more information, please read the docs.`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {
                            text: "Approve Migration Request",
                            style: "primary",
                        },
                        migrationRequestCommand,
                        {
                            approval: ApprovalEnum.APPROVED,
                        }),
                    buttonForCommand(
                        {
                            text: "Cancel Migration Request",
                        },
                        migrationRequestCommand,
                        {
                            approval: ApprovalEnum.REJECTED,
                        }),
                ],
            }],
        };
    }
}
