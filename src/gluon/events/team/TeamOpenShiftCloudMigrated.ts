import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {timeout, TimeoutError} from "promise-timeout";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {ConfigurePackageInJenkins} from "../../tasks/packages/ConfigurePackageInJenkins";
import {ConfigureJenkinsForProject} from "../../tasks/project/ConfigureJenkinsForProject";
import {CreateOpenshiftEnvironments} from "../../tasks/project/CreateOpenshiftEnvironments";
import {CreateOpenshiftResourcesInProject} from "../../tasks/project/CreateOpenshiftResourcesInProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {AddJenkinsToDevOpsEnvironment} from "../../tasks/team/AddJenkinsToDevOpsEnvironment";
import {CreateTeamDevOpsEnvironment} from "../../tasks/team/CreateTeamDevOpsEnvironment";
import {
    getAllPipelineOpenshiftNamespacesForAllPipelines,
    OpenshiftProjectEnvironmentRequest,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
import {QMTeam} from "../../util/team/Teams";
import {EventToGluon} from "../../util/transform/EventToGluon";

@EventHandler("Receive TeamOpenShiftCloudMigratedEvent events", `
subscription TeamOpenShiftCloudMigratedEvent {
  TeamOpenShiftCloudMigratedEvent {
    id
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
      openShiftCloud
      owners {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
      members {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
    }
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
    previousCloud
  }
}
`)
export class TeamOpenShiftCloudMigrated extends BaseQMEvent implements HandleEvent<any> {

    constructor(private ocService: OCService = new OCService(), private gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested TeamOpenShiftCloudMigrated event: ${JSON.stringify(event.data)}`);

        const teamCloudMigrationEvent = event.data.TeamOpenShiftCloudMigratedEvent[0];

        try {
            const team: QMTeam = EventToGluon.gluonTeam(teamCloudMigrationEvent.team);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            const taskRunner = await this.createMigrateTeamToCloudTasks(qmMessageClient, team, teamCloudMigrationEvent.previousCloud);

            await taskRunner.execute(ctx);

            this.succeedEvent();

            return qmMessageClient.send(`:rocket: Team successfully migrated to *${team.openShiftCloud}* cloud.`);

        } catch (error) {
            this.failEvent();
            return await this.handleError(ctx, error, teamCloudMigrationEvent.team.slackIdentity.teamChannel);
        }
    }

    private async createMigrateTeamToCloudTasks(qmMessageClient: QMMessageClient, team: QMTeam, previousCloud: string) {
        const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Migrating Team to cloud *${team.openShiftCloud}* started:`,
            qmMessageClient);
        const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

        taskRunner.addTask(
            new CreateTeamDevOpsEnvironment(team, QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd),
        ).addTask(
            new AddJenkinsToDevOpsEnvironment(team),
        );

        const projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(team.name, false);
        for (const project of projects) {
            await this.addCreateProjectEnvironmentsTasks(taskRunner, team, project, previousCloud);
        }

        return taskRunner;
    }

    private async addCreateProjectEnvironmentsTasks(taskRunner: TaskRunner, team: QMTeam, project: QMProject, previousCloud: string) {

        const tenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[previousCloud].openshiftNonProd);

        const environmentsForCreation: OpenShiftProjectNamespace[] = getAllPipelineOpenshiftNamespacesForAllPipelines(tenant.name, project);

        const createOpenshiftEnvironmentsDetails: OpenshiftProjectEnvironmentRequest = {
            project,
            owningTenant: tenant,
            teams: [team],
        };

        const openShiftNonProd: OpenShiftConfig = QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd;

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
                undefined,
                0,
            );
        }

        const applications: QMApplication[] = await this.gluonService.applications.gluonApplicationsLinkedToGluonProject(project.name, false);

        for (const application of applications) {
            taskRunner.addTask(new ConfigurePackageInJenkins(application, project), `*Create ${application.name} application Jenkins job*`);
        }
    }

    private async handleError(ctx: HandlerContext, error, teamChannel: string) {
        return await handleQMError(new ChannelMessageClient(ctx).addDestination(teamChannel), error);
    }
}
