import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {QMConfig} from "../../../config/QMConfig";
import {BitbucketConfigurationService} from "../../services/bitbucket/BitbucketConfigurationService";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {AddMemberToTeamService} from "../../services/team/AddMemberToTeamService";
import {userFromDomainUser} from "../../util/member/Members";
import {
    getAllPipelineOpenshiftNamespacesForAllPipelines,
    QMProject,
} from "../../util/project/Project";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    ChannelMessageClient,
    handleQMError,
    QMError,
} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {EventToGluon} from "../../util/transform/EventToGluon";

@EventHandler("Receive MembersAddedToTeamEvent events", `
subscription MembersAddedToTeamEvent {
  MembersAddedToTeamEvent {
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
      openShiftCloud
    }
    owners{
      firstName
      domainUsername
      slackIdentity {
        screenName
        userId
      }
    }
    members{
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
export class MembersAddedToTeam extends BaseQMEvent implements HandleEvent<any> {

    constructor(private gluonService = new GluonService(),
                private addMemberToTeamService = new AddMemberToTeamService(),
                private bitbucketService = new BitbucketService(),
                private ocService = new OCService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested MembersAddedToTeamEvent event: ${JSON.stringify(event.data)}`);

        const membersAddedToTeamEvent = event.data.MembersAddedToTeamEvent[0];

        try {
            await this.inviteMembersToChannel(ctx, membersAddedToTeamEvent);

            const team = membersAddedToTeamEvent.team;

            const projects = await this.getListOfTeamProjects(team.name);

            await this.addPermissionsForUserToTeams(EventToGluon.gluonTeam(team), projects, membersAddedToTeamEvent);

            const destination = await addressSlackChannelsFromContext(ctx, team.slackIdentity.teamChannel);
            this.succeedEvent();
            return await ctx.messageClient.send("New user permissions successfully added to associated projects.", destination);
        } catch (error) {
            this.failEvent();
            return await this.handleError(ctx, error, membersAddedToTeamEvent.team.slackIdentity.teamChannel);
        }
    }

    private async getListOfTeamProjects(teamName: string) {
        let projects;
        try {
            projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(teamName, false);
        } catch (error) {
            throw new QMError(error, "Failed to get list of projects associated with this team.");
        }
        return projects;
    }

    private async inviteMembersToChannel(ctx: HandlerContext, addMembersToTeamEvent) {

        for (const member of addMembersToTeamEvent.members) {
            await this.addMemberToTeamService.inviteUserToSlackChannel(
                ctx,
                member.firstName,
                addMembersToTeamEvent.team.name,
                addMembersToTeamEvent.team.slackIdentity.teamChannel,
                member.slackIdentity.userId,
                member.slackIdentity.screenName);
        }

        for (const owner of addMembersToTeamEvent.owners) {
            await this.addMemberToTeamService.inviteUserToSlackChannel(
                ctx,
                owner.firstName,
                addMembersToTeamEvent.team.name,
                addMembersToTeamEvent.team.slackIdentity.teamChannel,
                owner.slackIdentity.userId,
                owner.slackIdentity.screenName);
        }
    }

    private async addPermissionsForUserToTeams(team: QMTeam, projects: QMProject[], membersAddedToTeamEvent) {
        const bitbucketConfiguration = new BitbucketConfigurationService(this.bitbucketService);
        const osEnv = QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd;
        await this.ocService.setOpenShiftDetails(osEnv);

        const devopsProject = getDevOpsEnvironmentDetails(team.name).openshiftProjectId;

        await this.ocService.addTeamMembershipPermissionsToProject(devopsProject, membersAddedToTeamEvent, osEnv.usernameCase);
        for (const project of projects) {
            logger.info(`Configuring permissions for project: ${project}`);
            // Add to bitbucket
            await bitbucketConfiguration.addAllMembersToProject(
                project.bitbucketProject.key,
                membersAddedToTeamEvent.members.map(member => userFromDomainUser(member.domainUsername, osEnv.usernameCase)));
            await bitbucketConfiguration.addAllOwnersToProject(
                project.bitbucketProject.key,
                membersAddedToTeamEvent.owners.map(owner => userFromDomainUser(owner.domainUsername, osEnv.usernameCase)),
            );
            const tenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

            // Add to openshift environments
            for (const openShiftNamespace of getAllPipelineOpenshiftNamespacesForAllPipelines(tenant.name, project)) {
                await this.ocService.addTeamMembershipPermissionsToProject(openShiftNamespace.namespace, membersAddedToTeamEvent, osEnv.usernameCase);
            }
        }
    }

    private async handleError(ctx: HandlerContext, error, teamChannel: string) {
        const messageClient = new ChannelMessageClient(ctx);
        messageClient.addDestination(teamChannel);
        return await handleQMError(messageClient, error);
    }
}
