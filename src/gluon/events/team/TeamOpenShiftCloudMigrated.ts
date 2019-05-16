import {OpenshiftListResource, OpenshiftResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {
    addressSlackChannelsFromContext,
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";

import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {ReRunMigrateTeamCloud} from "../../commands/team/ReRunMigrateTeamCloud";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {ConfigurePackageDeploymentPipelineInJenkins} from "../../tasks/packages/ConfigurePackageDeploymentPipelineInJenkins";
import {ConfigurePackagePipelineInJenkins} from "../../tasks/packages/ConfigurePackagePipelineInJenkins";
import {ConfigureJenkinsForProject} from "../../tasks/project/ConfigureJenkinsForProject";
import {CreateOpenshiftEnvironments} from "../../tasks/project/CreateOpenshiftEnvironments";
import {CreateOpenshiftResourcesInProject} from "../../tasks/project/CreateOpenshiftResourcesInProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {AddJenkinsToDevOpsEnvironment} from "../../tasks/team/AddJenkinsToDevOpsEnvironment";
import {CreateTeamDevOpsEnvironment} from "../../tasks/team/CreateTeamDevOpsEnvironment";
import {
    EmptyJenkinsJobTemplate,
    getJenkinsMultiBranchProjectJobTemplateFile,
    JenkinsDeploymentJobTemplate,
    JenkinsJobTemplate,
} from "../../util/jenkins/JenkinsJobTemplates";
import {ApplicationType} from "../../util/packages/Applications";
import {
    getAllPipelineOpenshiftNamespacesForAllPipelines,
    OpenshiftProjectEnvironmentRequest,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
import {
    DevOpsEnvironmentDetails,
    getDevOpsEnvironmentDetails,
    QMTeam,
} from "../../util/team/Teams";
import {EventToGluon} from "../../util/transform/EventToGluon";
import {buildJenkinsDeploymentJobTemplates} from "../packages/package-configuration-request/JenkinsDeploymentJobTemplateBuilder";

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

        const teamCloudMigrationEvent: any = event.data.TeamOpenShiftCloudMigratedEvent[0];

        const team: QMTeam = EventToGluon.gluonTeam(teamCloudMigrationEvent.team);
        const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

        try {
            const taskRunner = await this.createMigrateTeamToCloudTasks(qmMessageClient, team, teamCloudMigrationEvent.previousCloud);

            await taskRunner.execute(ctx);
            this.succeedEvent();

            return qmMessageClient.send(`:rocket: Team successfully migrated to *${team.openShiftCloud}* cloud.`);

        } catch (error) {
            this.failEvent();
            await handleQMError(qmMessageClient, error);

            const correlationId: string = ctx.correlationId;
            const destination = await addressSlackChannelsFromContext(ctx, EventToGluon.gluonTeam(teamCloudMigrationEvent.team).slack.teamChannel);

            return await ctx.messageClient.send(this.createRetryMigrationButton(correlationId, JSON.stringify(teamCloudMigrationEvent)), destination, {id: correlationId});
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

        await this.addDevOpsResourceCopyingTasks(taskRunner, team, previousCloud);

        const projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(team.name, false);
        for (const project of projects) {
            await this.addCreateProjectEnvironmentsTasks(taskRunner, team, project, previousCloud);
        }

        return taskRunner;
    }

    /*
     * Creates a task to copy all the ImageStreams and BuildConfig resources from the source cloud devops to the destination cloud devops
     */
    private async addDevOpsResourceCopyingTasks(taskRunner: TaskRunner, team: QMTeam, previousCloud: string) {
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[previousCloud].openshiftNonProd);
        const subatomicImageStreams: OpenshiftResource[] = await this.ocService.getSubatomicImageStreamTags(QMConfig.subatomic.openshiftClouds[previousCloud].sharedResourceNamespace);
        const resourceKindsForExport = ["BuildConfig", "ImageStream"];
        const devopsEnvironment: DevOpsEnvironmentDetails = getDevOpsEnvironmentDetails(team.name);
        const devopsResources: OpenshiftListResource = await this.ocService.exportAllResources(devopsEnvironment.openshiftProjectId, resourceKindsForExport);
        this.cleanBuildConfigImageStreams(devopsResources, subatomicImageStreams, QMConfig.subatomic.openshiftClouds[team.openShiftCloud].sharedResourceNamespace);

        const devopsOpenShiftProjectNamespace: OpenShiftProjectNamespace = {
            postfix: "devops",
            displayName: devopsEnvironment.name,
            namespace: devopsEnvironment.openshiftProjectId,
        };

        taskRunner.addTask(new CreateOpenshiftResourcesInProject([devopsOpenShiftProjectNamespace], devopsOpenShiftProjectNamespace.namespace, devopsResources, QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd),
            undefined,
            0);
    }

    private cleanBuildConfigImageStreams(allDevOpsResources: OpenshiftListResource, sourceCloudImageStreams: OpenshiftResource[], destinationSharedResourceNamespace) {
        for (const resource of allDevOpsResources.items) {
            if (resource.kind === "BuildConfig") {
                try {
                    resource.status = {};
                    const imageStreamName = resource.spec.strategy.sourceStrategy.from.name.split(":")[0];
                    // Check if s2i image stream is a subatomic image stream
                    for (const imageStream of sourceCloudImageStreams) {
                        // If yes, patch the namespace to the correct shared resources namespace in the new cloud
                        if (imageStream.metadata.name === imageStreamName) {
                            resource.spec.strategy.sourceStrategy.from.namespace = destinationSharedResourceNamespace;
                            break;
                        }
                    }
                } catch (e) {
                    logger.warn(`Failed to patch BC ${resource.metadata.name}`);
                    // Do nothing, this would occur if the bc is malformed and it wouldn't work anyway
                }
            }
        }
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
            const jenkinsBuildJobTemplate: JenkinsJobTemplate = EmptyJenkinsJobTemplate;
            jenkinsBuildJobTemplate.jobTemplateFilename = getJenkinsMultiBranchProjectJobTemplateFile();
            taskRunner.addTask(new ConfigurePackagePipelineInJenkins(application, project, jenkinsBuildJobTemplate), `*Create ${application.name} application Jenkins job*`);
            // Add Additional Jenkins Deployment jobs
            if (application.applicationType === ApplicationType.DEPLOYABLE.toString()) {
                const jenkinsDeploymentJobTemplates: JenkinsDeploymentJobTemplate[] = buildJenkinsDeploymentJobTemplates(
                    tenant.name,
                    project.name,
                    project.devDeploymentPipeline,
                    project.releaseDeploymentPipelines,
                    QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd,
                );

                taskRunner.addTask(new ConfigurePackageDeploymentPipelineInJenkins(application, project, jenkinsDeploymentJobTemplates), "Configure Package Deployment Jobs in Jenkins");
            }
        }
    }

    private async handleError(ctx: HandlerContext, error, teamChannel: string) {
        return await handleQMError(new ChannelMessageClient(ctx).addDestination(teamChannel), error);
    }

    private createRetryMigrationButton(correlationId: string, teamCloudMigrationEvent: string) {

        const msg: string = "Please check with your team and retry when the reason for the failure has been corrected.";

        return {
            text: "Your migration failed to run successfully.",
            attachments: [{
                text: msg,
                fallback: msg,
                color: QMColours.stdGreenyMcAppleStroodle.hex,
                actions: [
                    buttonForCommand(
                        {
                            text: "Retry Migration",
                            style: "primary",
                        },
                        new ReRunMigrateTeamCloud(), {
                            correlationId,
                            teamCloudMigrationEvent,
                        },
                    ),
                ],
            },
            ],
        };
    }
}
