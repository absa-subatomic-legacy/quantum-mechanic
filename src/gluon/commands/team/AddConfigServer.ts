import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter, GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Add a new Subatomic Config Server", QMConfig.subatomic.commandPrefix + " add config server")
@Tags("subatomic", "team")
export class AddConfigServer extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    @Parameter({
        description: "Remote Git repository SSH",
        pattern: /^ssh:\/\/.*$/,
    })
    public gitUri: string;

    constructor(public gluonService = new GluonService(),
                private ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);
            return await this.addConfigServer(
                ctx,
                this.teamName,
                this.gitUri,
            );
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async addConfigServer(ctx: HandlerContext,
                                  gluonTeamName: string,
                                  gitUri: string): Promise<any> {
        try {
            const devOpsProjectId = `${_.kebabCase(gluonTeamName).toLowerCase()}-devops`;
            await this.addConfigServerSecretToDevOpsEnvironment(devOpsProjectId);

            await this.createConfigServerConfigurationMap(devOpsProjectId);

            await this.tagConfigServerImageToDevOpsEnvironment(devOpsProjectId);

            await this.addViewRoleToDevOpsEnvironmentDefaultServiceAccount(devOpsProjectId);

            await this.createConfigServerDeploymentConfig(gitUri, devOpsProjectId);

            await this.sendSuccessResponse(ctx, devOpsProjectId);
            this.succeedCommand();
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
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

    private async sendSuccessResponse(ctx: HandlerContext, devOpsProjectId: string) {
        const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
        const slackMessage: SlackMessage = {
            text: `Your Subatomic Config Server has been added to your *${devOpsProjectId}* OpenShift project successfully`,
            attachments: [{
                fallback: `Your Subatomic Config Server has been added successfully`,
                footer: `For more information, please read the ${this.docs()}`,
            }],
        };

        return await ctx.messageClient.send(slackMessage, destination);
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/config-server`,
            "documentation")}`;
    }

}
