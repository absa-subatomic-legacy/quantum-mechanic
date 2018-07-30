import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {addressEvent} from "@atomist/automation-client/spi/message/MessageClient";
import * as _ from "lodash";
import {timeout, TimeoutError} from "promise-timeout";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";
import {TaskListMessage, TaskStatus} from "../../util/shared/TaskListMessage";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";

@EventHandler("Receive DevOpsEnvironmentRequestedEvent events", `
subscription DevOpsEnvironmentRequestedEvent {
  DevOpsEnvironmentRequestedEvent {
    id
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
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
  }
}
`)
export class DevOpsEnvironmentRequested implements HandleEvent<any> {

    constructor(private jenkinsService = new JenkinsService(),
                private ocService = new OCService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested DevOpsEnvironmentRequestedEvent event: ${JSON.stringify(event.data)}`);

        const devOpsRequestedEvent = event.data.DevOpsEnvironmentRequestedEvent[0];

        const teamChannel = devOpsRequestedEvent.team.slackIdentity.teamChannel;

        const taskList = new TaskListMessage(`🚀 Provisioning of DevOps environment for team *${devOpsRequestedEvent.team.name}* started:`, new ChannelMessageClient(ctx).addDestination(teamChannel));
        taskList.addTask("OpenshiftEnv", "Create DevOps Openshift Project");
        taskList.addTask("OpenshiftPermissions", "Add Openshift Permissions");
        taskList.addTask("Resources", "Copy Subatomic resources to DevOps Project");
        taskList.addTask("ConfigSecrets", "Add Secrets");

        try {
            const projectId = `${_.kebabCase(devOpsRequestedEvent.team.name).toLowerCase()}-devops`;
            logger.info(`Working with OpenShift project Id: ${projectId}`);

            await taskList.display();

            await this.ocService.login();

            await this.createDevOpsEnvironment(projectId, devOpsRequestedEvent.team.name);

            await taskList.setTaskStatus("OpenshiftEnv", TaskStatus.Successful);

            await this.ocService.addTeamMembershipPermissionsToProject(projectId,
                devOpsRequestedEvent.team);

            await taskList.setTaskStatus("OpenshiftPermissions", TaskStatus.Successful);

            await this.copySubatomicAppTemplatesToDevOpsEnvironment(projectId);
            await this.ocService.tagAllSubatomicImageStreamsToDevOpsEnvironment(projectId);

            await taskList.setTaskStatus("Resources", TaskStatus.Successful);

            await this.addBitbucketSSHSecret(projectId);

            await taskList.setTaskStatus("ConfigSecrets", TaskStatus.Successful);

            const devopsEnvironmentProvisionedEvent = {
                team: devOpsRequestedEvent.team,
                devOpsEnvironment: getDevOpsEnvironmentDetails(devOpsRequestedEvent.team.name),
            };

            return await ctx.messageClient.send(devopsEnvironmentProvisionedEvent, addressEvent("DevOpsEnvironmentProvisionedEvent"));

        } catch (error) {
            await taskList.failRemainingTasks();
            return await this.handleError(ctx, error, devOpsRequestedEvent.team.slackIdentity.teamChannel);
        }
    }

    private async createDevOpsEnvironment(projectId: string, teamName: string) {
        try {
            await this.ocService.newDevOpsProject(projectId, teamName);
        } catch (error) {
            logger.warn("DevOps project already seems to exist. Trying to continue.");
        }

        await this.ocService.createDevOpsDefaultResourceQuota(projectId);

        await this.ocService.createDevOpsDefaultLimits(projectId);

        return {};
    }

    private async copySubatomicAppTemplatesToDevOpsEnvironment(projectId: string) {
        logger.info(`Finding templates in subatomic namespace`);

        const appTemplatesJSON = await this.ocService.getSubatomicAppTemplates();

        const appTemplates: any = JSON.parse(appTemplatesJSON.output);
        for (const item of appTemplates.items) {
            item.metadata.namespace = projectId;
        }
        await this.ocService.createResourceFromDataInNamespace(appTemplates, projectId);
    }

    private async addBitbucketSSHSecret(projectId: string) {
        try {
            await this.ocService.getSecretFromNamespace("bitbucket-ssh", projectId);
            logger.warn("Bitbucket SSH secret must already exist");
        } catch (error) {
            await this.ocService.createBitbucketSSHAuthSecret("bitbucket-ssh", projectId);
        }
    }

    private async handleError(ctx: HandlerContext, error, teamChannel: string) {
        return await handleQMError(new ChannelMessageClient(ctx).addDestination(teamChannel), error);
    }
}
