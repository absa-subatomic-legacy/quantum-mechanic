import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {SlackMessage, url} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";
import {GluonTeamEvent} from "../../util/transform/types/event/GluonTeamEvent";
import {MemberEvent} from "../../util/transform/types/event/MemberEvent";

@EventHandler("Receive ConfigServerRequested events", `
subscription ConfigServerRequestedEvent {
  ConfigServerRequestedEvent {
    id
    team{
      name
      openShiftCloud
      slackIdentity {
        teamChannel
      }
    }
    actionedBy{
      firstName
      slackIdentity {
        screenName
      }
    }
    configRepositoryGitURI
  }
}
`)
export class ConfigServerRequested extends BaseQMEvent implements HandleEvent<any> {

    constructor(private gluonService: GluonService = new GluonService(),
                private ocService = new OCService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ConfigServerRequested event: ${JSON.stringify(event.data)}`);
        const configServerRequestedEvent: ConfigServerRequestedEvent = event.data.ConfigServerRequestedEvent[0];

        const messageClient: QMMessageClient = new ChannelMessageClient(ctx).addDestination(configServerRequestedEvent.team.slackIdentity.teamChannel);

        try {
            await this.addConfigServer(configServerRequestedEvent.team.name, configServerRequestedEvent.team.openShiftCloud, configServerRequestedEvent.configRepositoryGitURI);
            this.succeedEvent();
            return await this.sendSuccessResponse(messageClient, configServerRequestedEvent.team.name);
        } catch (error) {
            this.failEvent();
            return await handleQMError(messageClient, error);
        }
    }

    private async addConfigServer(gluonTeamName: string,
                                  openShiftCloud: string,
                                  gitUri: string): Promise<any> {
        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[openShiftCloud].openshiftNonProd);
        const devOpsProjectId = getDevOpsEnvironmentDetails(gluonTeamName).openshiftProjectId;
        await this.addConfigServerSecretToDevOpsEnvironment(devOpsProjectId);

        await this.createConfigServerConfigurationMap(devOpsProjectId);

        await this.tagConfigServerImageToDevOpsEnvironment(devOpsProjectId);

        await this.addViewRoleToDevOpsEnvironmentDefaultServiceAccount(devOpsProjectId);

        await this.createConfigServerDeploymentConfig(gitUri, devOpsProjectId);
    }

    private async addConfigServerSecretToDevOpsEnvironment(devOpsProjectId: string) {
        try {
            await this.ocService.createConfigServerSecret(devOpsProjectId);
        } catch (error) {
            logger.warn("Secret subatomic-config-server probably already exists");
        }
    }

    private async createConfigServerConfigurationMap(devOpsProjectId: string) {
        const configurationMapDefintion = {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
                name: "subatomic-config-server",
            },
            data: {
                "application.yml": `
spring:
  cloud:
    config:
      server:
        git:
          ignoreLocalSshSettings: true
          strictHostKeyChecking: false
          hostKeyAlgorithm: ssh-rsa
`,
            },
        };
        return await this.ocService.applyResourceFromDataInNamespace(configurationMapDefintion, devOpsProjectId);
    }

    private async tagConfigServerImageToDevOpsEnvironment(devOpsProjectId: string) {
        return await this.ocService.tagSubatomicImageToNamespace(
            "subatomic-config-server:3.0",
            devOpsProjectId,
            "subatomic-config-server:3.0");
    }

    private async addViewRoleToDevOpsEnvironmentDefaultServiceAccount(devOpsProjectId: string) {
        return await this.ocService.addRoleToUserInNamespace(
            `system:serviceaccount:${devOpsProjectId}:default`,
            "view",
            devOpsProjectId);
    }

    private async createConfigServerDeploymentConfig(gitUri: string, devOpsProjectId: string) {
        try {
            await this.ocService.getDeploymentConfigInNamespace("subatomic-config-server", devOpsProjectId);
            logger.warn(`Subatomic Config Server Template has already been processed, deployment exists`);
        } catch (error) {
            const saneGitUri = _.replace(gitUri, /(<)|>/g, "");

            const templateParameters = [
                {key: "GIT_URI", value: saneGitUri},
                {key: "IMAGE_STREAM_PROJECT", value: devOpsProjectId},
            ];

            const appTemplate = await this.ocService.findAndProcessOpenshiftTemplate(
                "subatomic-config-server-template",
                "subatomic",
                templateParameters);

            logger.debug(`Processed Subatomic Config Server Template: ${JSON.stringify(appTemplate)}`);

            await this.ocService.applyResourceFromDataInNamespace(appTemplate, devOpsProjectId);
        }
    }

    private async sendSuccessResponse(messageClient: QMMessageClient, gluonTeamName: string) {
        const devOpsProjectId = getDevOpsEnvironmentDetails(gluonTeamName).openshiftProjectId;
        const slackMessage: SlackMessage = {
            text: `Your Subatomic Config Server has been added to your *${devOpsProjectId}* OpenShift project successfully`,
            attachments: [{
                fallback: `Your Subatomic Config Server has been added successfully`,
                footer: `For more information, please read the ${this.docs()}`,
            }],
        };

        return await messageClient.send(slackMessage);
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference`,
            "documentation")}`;
    }
}

export interface ConfigServerRequestedEvent {
    team: GluonTeamEvent;
    actionedBy: MemberEvent;
    configRepositoryGitURI: string;
}
