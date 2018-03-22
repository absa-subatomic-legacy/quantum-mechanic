import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import * as _ from "lodash";
import {BitbucketConfiguration} from "../bitbucket/BitbucketConfiguration";
import {gluonProjectsWhichBelongToGluonTeam} from "../project/Projects";
import {addOpenshiftMembershipPermissions} from "./DevOpsEnvironmentRequested";

@EventHandler("Receive MembershipRequestCreated events", `
subscription MembersAddedToTeamEvent {
  MembersAddedToTeamEvent {
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    owners{
      firstName
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
export class MembersAddedToTeam implements HandleEvent<any> {

    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested MembersAddedToTeamEvent event: ${JSON.stringify(event.data)}`);

        const membersAddedToTeamEvent = event.data.membersAddedToTeamEvent[0];
        const team = membersAddedToTeamEvent.team;

        return gluonProjectsWhichBelongToGluonTeam(ctx, team.name).then(projects => {
                let teamOwnersUsernames: string[] = [];
                let teamMembersUsernames: string[] = [];

                teamOwnersUsernames = _.union(teamOwnersUsernames, team.owners.map(owner => owner.domainUsername));
                teamMembersUsernames = _.union(teamMembersUsernames, team.members.map(member => member.domainUsername));
                const bitbucketConfiguration = new BitbucketConfiguration(teamOwnersUsernames, teamMembersUsernames);

                const permissionPromises: Array<Promise<any>> = [];
                const devopsProject = `${_.kebabCase(team.name).toLowerCase()}-devops`;
                permissionPromises.push(addOpenshiftMembershipPermissions(devopsProject, team));
                for (const project of projects) {
                    // Add to bitbucket
                    permissionPromises.push(
                        bitbucketConfiguration.configureBitbucketProject(project.key),
                    );
                    // Add to openshift environments
                    for (const environment of ["dev", "sit", "uat"]) {
                        const projectId = `${_.kebabCase(project.name).toLowerCase()}-${environment}`;
                        permissionPromises.push(
                            addOpenshiftMembershipPermissions(projectId, team),
                        );
                    }

                }
                return Promise.all(permissionPromises);
            },
        ).then(() => {
            return ctx.messageClient.addressChannels("New user permissions successfully added to associated projects.", team.slackIdentity.teamChannel);
        });
    }
}
