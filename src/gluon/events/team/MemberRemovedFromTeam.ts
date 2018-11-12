import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {OCCommandResult} from "../../../openshift/base/OCCommandResult";
import {BitbucketConfigurationService} from "../../services/bitbucket/BitbucketConfigurationService";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {RemoveMemberFromTeamService} from "../../services/team/RemoveMemberFromTeamService";
import {getProjectId} from "../../util/project/Project";
import {
    ChannelMessageClient,
    handleQMError,
    OCResultError, QMError,
} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";

@EventHandler("Receive MemberRemovedFromTeam events", `
subscription MemberRemovedFromTeamEvent {
 MemberRemovedFromTeamEvent {
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    memberRemoved{
      firstName
      domainUsername
      slackIdentity {
        screenName
        userId
      }
    }
    memberRequester{
      firstName
      domainUsername
      slackIdentity {
        screenName
        userId
      }
    }
  }
}
`)
export class MemberRemovedFromTeam implements HandleEvent<any> {

    constructor(private gluonService = new GluonService(),
                private removeMemberTeamService = new RemoveMemberFromTeamService(),
                private bitbucketService = new BitbucketService(),
                private ocService = new OCService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {

        logger.info(`Ingested MemberRemovedFromTeamEvent, event.data = ${JSON.stringify(event.data)}`);
        const memberRemovedFromTeam = event.data.MemberRemovedFromTeamEvent[0];
        try {

            await this.removeMemberFromChannel(ctx, memberRemovedFromTeam);

            const team = memberRemovedFromTeam.team;
            const projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(
                team.name, false);
            const bitbucketConfiguration = new BitbucketConfigurationService(this.bitbucketService);
            await this.removePermissionsForUserFromTeams(
                bitbucketConfiguration, team.name, projects, memberRemovedFromTeam);

            return await ctx.messageClient.addressChannels(
                "User permissions successfully removed from associated projects.",
                team.slackIdentity.teamChannel);
        } catch (error) {
            return await handleQMError(new ChannelMessageClient(ctx).addDestination(
                memberRemovedFromTeam.team.slackIdentity.teamChannel),
                error);
        }
    }

    private async removePermissionsForUserFromTeams(
        bitbucketConfiguration: BitbucketConfigurationService, teamName: string, projects, memberRemovedFromTeam) {
        try {
            await this.ocService.login(QMConfig.subatomic.openshiftNonProd, true);
            const devopsProject = getDevOpsEnvironmentDetails(teamName).openshiftProjectId;
            await this.ocService.removeTeamMembershipPermissionsFromProject(
                devopsProject, memberRemovedFromTeam.memberRemoved.domainUsername);

            for (const project of projects) {
                logger.info(`Removing permissions for project: ${project}`);

                // Remove from BitBucket
                await bitbucketConfiguration.removeUserFromBitbucketProject(
                    project.bitbucketProject.key,
                    [memberRemovedFromTeam.memberRemoved.domainUsername]);

                // Remove from OpenShift environments
                for (const environment of QMConfig.subatomic.openshiftNonProd.defaultEnvironments) {
                    const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);
                    const projectId = getProjectId(tenant.name, project.name, environment.id);
                    await this.ocService.removeTeamMembershipPermissionsFromProject(
                        projectId,
                        memberRemovedFromTeam.memberRemoved.domainUsername);
                }
            }
        } catch (error) {
            if (error instanceof OCCommandResult) {
                throw new OCResultError(
                    error,
                    `Failed to remove OpenShift team member permissions from the team projects.`);
            }
            throw error;
        }
    }

    private async removeMemberFromChannel(ctx: HandlerContext, memberRemovedFromTeam) {
        try {
            await this.removeMemberTeamService.removeUserFromSlackChannel(
                ctx,
                memberRemovedFromTeam.memberRemoved.firstName,
                memberRemovedFromTeam.team.name,
                memberRemovedFromTeam.team.slackIdentity.teamChannel,
                // memberRemovedFromTeam.memberRemoved.slackIdentity.userId,
                "1234",
                memberRemovedFromTeam.memberRemoved.slackIdentity.screenName);
        } catch (error) {
            return await new QMError(error,
                `Failed to remove ${memberRemovedFromTeam.memberRemoved.slackIdentity.screenName} from ${memberRemovedFromTeam.team.slackIdentity.teamChannel}, please remove the user manually.`);
        }
    }
}
