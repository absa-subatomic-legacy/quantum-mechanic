import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {configuration} from "@atomist/lifecycle-automation";
import {QMConfig} from "../../../config/QMConfig";
import {OpenshiftListResource} from "../../../openshift/api/resources/OpenshiftResource";
import {QMApplicationProdRequest} from "../../services/gluon/ApplicationProdRequestService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {GenericOpenshiftResourceService} from "../../services/projects/GenericOpenshiftResourceService";
import {CreateOpenshiftResourcesInProject} from "../../tasks/project/CreateOpenshiftResourcesInProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {getHighestPreProdEnvironment} from "../../util/openshift/Helpers";
import {
    getPipelineOpenShiftNamespacesForOpenShiftCluster,
    getProjectOpenshiftNamespace,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
import {QMTeam} from "../../util/team/Teams";

@EventHandler("Receive ApplicationProdRequestedEvent events", `
subscription ApplicationProdRequestedEvent {
  ApplicationProdRequestedEvent {
    id
    applicationProdRequest{
      applicationProdRequestId
    }
    application {
      applicationId
      name
      description
      applicationType
    }
    project {
      projectId
      name
      description
      tenant {
        tenantId
      }
    }
    owningTeam {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    teams {
      teamId
      name
      openShiftCloud
      slackIdentity {
        teamChannel
      }
    }
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class ApplicationProdRequested extends BaseQMEvent implements HandleEvent<any> {

    constructor(public ocService = new OCService(),
                public gluonService = new GluonService(),
                public genericOpenshiftResourceService = new GenericOpenshiftResourceService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ApplicationProdRequestedEvent event: ${JSON.stringify(event.data)}`);

        const applicationProdRequestedEvent = event.data.ApplicationProdRequestedEvent[0];

        const qmMessageClient = this.createMessageClient(ctx, applicationProdRequestedEvent.teams);

        try {
            const project = applicationProdRequestedEvent.project;

            const qmProject: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(project.name);
            const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(qmProject.owningTeam.teamId);

            const tenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.tenant.tenantId);

            const applicationProdRequest: QMApplicationProdRequest = await this.gluonService.prod.application.getApplicationProdRequestById(applicationProdRequestedEvent.applicationProdRequest.applicationProdRequestId);

            logger.debug("List of requested prod resources: " + JSON.stringify(applicationProdRequest));

            const resources: OpenshiftListResource = this.getRequestedProdResources(applicationProdRequest);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Creating requested application resources in project *${project.name}* production environments started:`,
                qmMessageClient);

            const preProdNamespace: string = getProjectOpenshiftNamespace(
                tenant.name,
                project.name,
                applicationProdRequest.deploymentPipeline.tag,
                getHighestPreProdEnvironment(applicationProdRequest.deploymentPipeline).postfix,
            );

            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);
            for (const openshiftProd of QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftProd) {
                const environmentsForCreation: OpenShiftProjectNamespace[] = getPipelineOpenShiftNamespacesForOpenShiftCluster(tenant.name, qmProject, applicationProdRequest.deploymentPipeline, openshiftProd);
                taskRunner.addTask(
                    new CreateOpenshiftResourcesInProject(environmentsForCreation, preProdNamespace, resources, openshiftProd),
                    undefined,
                    1);
            }

            await taskRunner.execute(ctx);
            this.succeedEvent();
            return await qmMessageClient.send("Resources successfully created in production environments.");
        } catch (error) {
            this.failEvent();
            return await handleQMError(qmMessageClient, error);
        }
    }

    private getRequestedProdResources(applicationProdRequest: any): OpenshiftListResource {
        const resources = {
            kind: "List",
            apiVersion: configuration.apiVersion,
            metadata: {},
            items: [],
        };
        for (const openShiftResource of applicationProdRequest.openShiftResources) {
            resources.items.push(JSON.parse(openShiftResource.resourceDetails));
        }
        return resources;
    }

    private createMessageClient(ctx: HandlerContext, teams) {
        const qmMessageClient = new ChannelMessageClient(ctx);
        for (const team of teams) {
            qmMessageClient.addDestination(team.slackIdentity.teamChannel);
        }
        return qmMessageClient;
    }

}
