import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {PackageOpenshiftResourceService} from "../../services/packages/PackageOpenshiftResourceService";
import {getProjectId} from "../../util/project/Project";

@EventHandler("Receive ApplicationProdRequestedEvent events", `
subscription ApplicationProdRequestedEvent {
  ApplicationProdRequestedEvent {
    id
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
export class ApplicationProdRequested implements HandleEvent<any> {

    constructor(public packageOpenshiftResourceService = new PackageOpenshiftResourceService(),
                public ocService = new OCService(),
                public gluonService = new GluonService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ApplicationProdRequestedEvent event: ${JSON.stringify(event.data)}`);

        const applicationCreatedEvent = event.data.ApplicationProdRequestedEvent[0];

        const project = applicationCreatedEvent.project;

        const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.tenant.tenantId);

        const application = applicationCreatedEvent.application;

        await this.ocService.login(QMConfig.subatomic.openshiftNonProd);

        const allResources = await this.ocService.exportAllResources(getProjectId(tenant.name, project.name, this.packageOpenshiftResourceService.getPreProdEnvironment().id));

        const resources = await this.packageOpenshiftResourceService.getAllApplicationRelatedResources(
            application.name,
            allResources,
        );

        logger.info(resources);

        await ctx.messageClient.respond({
            text: this.packageOpenshiftResourceService.getDisplayMessage(resources),
        });

        for (const openshiftProd of QMConfig.subatomic.openshiftProd) {
            await this.ocService.login(openshiftProd);

            for (const environment of openshiftProd.defaultEnvironments) {
                const prodProjectId = getProjectId(tenant.name, project.name, environment.id);

                await ctx.messageClient.respond({
                    text: `Creating resources in ${openshiftProd.name}`,
                });

                await this.ocService.createResourceFromDataInNamespace(resources, prodProjectId);
            }
        }

        return await success();
    }

}
