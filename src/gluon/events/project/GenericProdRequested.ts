import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {CreateOpenshiftResourcesInProject} from "../../tasks/project/CreateOpenshiftResourcesInProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";

@EventHandler("Receive GenericProdRequestedEvent events", `
subscription GenericProdRequestedEvent {
  GenericProdRequestedEvent {
    id
    genericProdRequest{
      genericProdRequestId
    }
  }
}
`)
export class GenericProdRequested implements HandleEvent<any> {

    constructor(public ocService = new OCService(),
                public gluonService = new GluonService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested GenericProdRequestedEvent event: ${JSON.stringify(event.data)}`);

        const genericProdRequestedEvent = event.data.GenericProdRequestedEvent[0];

        const genericProdRequest = await this.gluonService.prod.generic.getGenericProdRequestById(genericProdRequestedEvent.genericProdRequestId);

        const associatedTeams = await this.gluonService.teams.getTeamsAssociatedToProject(genericProdRequest.project.projectId);

        const qmMessageClient = this.createMessageClient(ctx, associatedTeams);

        try {
            const project = genericProdRequestedEvent.project;

            const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.tenant.tenantId);

            const resources = this.getRequestedProdResources(genericProdRequest);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Creating requested resources in project *${project.name}* production environments started:`,
                qmMessageClient);

            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            for (const openshiftProd of QMConfig.subatomic.openshiftProd) {
                taskRunner.addTask(new CreateOpenshiftResourcesInProject(project.name, tenant.name, openshiftProd, resources));
            }

            await taskRunner.execute(ctx);

            return await qmMessageClient.send("Resources successfully created in production environments.");
        } catch (error) {
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
            qmMessageClient.addDestination(team.slackIdentity.teamChannel);
        }
        return qmMessageClient;
    }

}
