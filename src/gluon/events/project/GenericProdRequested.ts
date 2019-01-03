import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {QMConfig} from "../../../config/QMConfig";
import {QMGenericProdRequest} from "../../services/gluon/GenericProdRequestService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {CreateOpenshiftResourcesInProject} from "../../tasks/project/CreateOpenshiftResourcesInProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {
    getPipelineOpenShiftNamespacesForOpenShiftCluster,
    OpenShiftProjectNamespace,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
import {QMTeam} from "../../util/team/Teams";

@EventHandler("Receive GenericProdRequestedEvent events", `
subscription GenericProdRequestedEvent {
  GenericProdRequestedEvent {
    id
    genericProdRequestId
  }
}
`)
export class GenericProdRequested extends BaseQMEvent implements HandleEvent<any> {

    constructor(public ocService = new OCService(),
                public gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested GenericProdRequestedEvent event: ${JSON.stringify(event.data)}`);

        const genericProdRequestedEvent = event.data.GenericProdRequestedEvent[0];

        const genericProdRequest: QMGenericProdRequest = await this.gluonService.prod.generic.getGenericProdRequestById(genericProdRequestedEvent.genericProdRequestId);

        logger.info(JSON.stringify(genericProdRequest));

        const associatedTeams = await this.gluonService.teams.getTeamsAssociatedToProject(genericProdRequest.project.projectId);

        const qmMessageClient = this.createMessageClient(ctx, associatedTeams);

        try {
            const project = genericProdRequest.project;
            const qmProject: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(project.name);
            const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(qmProject.owningTeam.teamId);

            const tenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

            const resources = this.getRequestedProdResources(genericProdRequest);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Creating requested resources in project *${project.name}* production environments started:`,
                qmMessageClient);

            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            const preProdNamespace = getProjectOpenShiftNamespace(tenant.name, qmProject.name, getHighestPreProdEnvironment(owningTeam.openShiftCloud).id);

            for (const openshiftProd of QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftProd) {
                const environmentsForResources: OpenShiftProjectNamespace[] = getPipelineOpenShiftNamespacesForOpenShiftCluster(tenant.name, qmProject, genericProdRequest.deploymentPipeline, openshiftProd);
                taskRunner.addTask(new CreateOpenshiftResourcesInProject(environmentsForResources, resources, openshiftProd));
            }

            await taskRunner.execute(ctx);

            this.succeedEvent();
            return await qmMessageClient.send("Resources successfully created in production environments.");
        } catch (error) {
            this.failEvent();
            return await handleQMError(qmMessageClient, error);
        }
    }

    private getRequestedProdResources(applicationProdRequest: any) {
        const resources = {
            kind: "List",
            apiVersion: "v1",
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
            qmMessageClient.addDestination(team.slack.teamChannel);
        }
        return qmMessageClient;
    }

}
