import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {QMConfig} from "../../../config/QMConfig";
import {OCCommandResult} from "../../../openshift/base/OCCommandResult";
import {BitbucketConfigurationService} from "../../services/bitbucket/BitbucketConfigurationService";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {RemoveMemberFromTeamService} from "../../services/team/RemoveMemberFromTeamService";
import {
    getDeploymentEnvironmentNamespacesFromProject,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    ChannelMessageClient,
    handleQMError,
    OCResultError,
} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {EventToGluon} from "../../util/transform/EventToGluon";

@EventHandler("Receive MemberRemovedFromTeam events", `
subscription MemberRemovedFromTeamEvent {
 MemberRemovedFromTeamEvent {
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
      openShiftCloud
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
export class MemberRemovedFromTeam extends BaseQMEvent implements HandleEvent<any> {

    constructor(private gluonService = new GluonService(),
                private removeMemberTeamService = new RemoveMemberFromTeamService(),
                private bitbucketService = new BitbucketService(),
                private ocService = new OCService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {

        logger.info(`Ingested MemberRemovedFromTeamEvent, event.data = ${JSON.stringify(event.data)}`);
        const memberRemovedFromTeam = event.data.MemberRemovedFromTeamEvent[0];
        try {

            await this.removeMemberFromChannel(ctx, memberRemovedFromTeam);

            const team = memberRemovedFromTeam.team;
            const projects: QMProject[] = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(
                team.name, false);
            const bitbucketConfiguration = new BitbucketConfigurationService(this.bitbucketService);
            await this.removePermissionsForUserFromTeams(
                bitbucketConfiguration, EventToGluon.gluonTeam(team), projects, memberRemovedFromTeam);

            this.succeedEvent();
            return await ctx.messageClient.addressChannels(
                "User permissions successfully removed from associated projects.",
                team.slackIdentity.teamChannel);
        } catch (error) {
            this.failEvent();
            return await handleQMError(new ChannelMessageClient(ctx).addDestination(
                memberRemovedFromTeam.team.slackIdentity.teamChannel),
                error);
        }
    }

    private async removePermissionsForUserFromTeams(bitbucketConfiguration: BitbucketConfigurationService,
                                                    team: QMTeam, projects: QMProject[], memberRemovedFromTeam) {
        try {
            const osEnv = QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd;
            await this.ocService.setOpenShiftDetails(osEnv);

            const devopsProject = getDevOpsEnvironmentDetails(team.name).openshiftProjectId;
            await this.ocService.removeTeamMembershipPermissionsFromProject(
                devopsProject, memberRemovedFromTeam.memberRemoved.domainUsername);

            for (const project of projects) {
                logger.info(`Removing permissions for project: ${project}`);

                // Remove from BitBucket
                await bitbucketConfiguration.removeUserFromBitbucketProject(
                    project.bitbucketProject.key,
                    [memberRemovedFromTeam.memberRemoved.domainUsername]);
                const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

                // Remove from OpenShift environments
                for (const projectNamespace of getDeploymentEnvironmentNamespacesFromProject(tenant.name, project)) {
                    await this.ocService.removeTeamMembershipPermissionsFromProject(
                        projectNamespace,
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
                memberRemovedFromTeam.memberRemoved.slackIdentity.userId,
                memberRemovedFromTeam.memberRemoved.slackIdentity.screenName);
        } catch (error) {
            return await handleQMError(new ChannelMessageClient(ctx).addDestination(
                memberRemovedFromTeam.team.slackIdentity.teamChannel),
                error);
        }
    }
}
