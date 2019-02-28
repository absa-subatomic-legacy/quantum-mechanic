import {
    addressSlackChannelsFromContext,
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {LinkExistingBitbucketProject} from "../../commands/bitbucket/BitbucketProject";
import {AssociateTeam} from "../../commands/project/AssociateTeam";
import {CommandDocumentationLink} from "../../messages/documentation/CommandDocumentationLink";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {QMColours} from "../../util/QMColour";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";

@EventHandler("Receive ProjectCreated events", `
subscription ProjectCreatedEvent {
  ProjectCreatedEvent {
    id
    project {
      projectId
      name
      description
    }
    team {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    tenant {
      tenantId
      name
      description
    }
    createdBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class ProjectCreated extends BaseQMEvent implements HandleEvent<any> {

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectCreated event: ${JSON.stringify(event.data)}`);

        try {
            const projectCreatedEvent = event.data.ProjectCreatedEvent[0];

            const associateTeamCommand = new AssociateTeam();
            associateTeamCommand.projectName = projectCreatedEvent.project.name;

            const destination = await addressSlackChannelsFromContext(ctx, projectCreatedEvent.team.slackIdentity.teamChannel);
            this.succeedEvent();
            return await ctx.messageClient.send({
                text: `The *${projectCreatedEvent.project.name}* Subatomic project has been created successfully.`,
                attachments: [{
                    text: `
The new Subatomic project needs to be linked to an existing Bitbucket project.`,
                    fallback: "Link  an existing Bitbucket project",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandDocumentationLink.LinkExistingBitbucketProject)}`,
                    color: QMColours.stdGreenyMcAppleStroodle.hex,
                    thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/bitbucket-logo.png",
                    actions: [
                        buttonForCommand(
                            {text: "Link existing Bitbucket project"},
                            new LinkExistingBitbucketProject(), {
                                projectName: projectCreatedEvent.project.name,
                            }),
                    ],
                }, {
                    text: `
Projects can be associated with multiple teams. \
If you would like to associate more teams to the *${projectCreatedEvent.project.name}* Subatomic project, please use the \`@atomist sub associate team\` command`,
                    fallback: "Associate multiple teams to this project",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandDocumentationLink.AssociateTeam)}`,
                    color: QMColours.stdShySkyBlue.hex,
                    actions: [
                        buttonForCommand(
                            {
                                text: "Associate team",
                            },
                            associateTeamCommand),
                    ],
                }],
            }, destination);
        } catch {
            this.failEvent();
        }
    }

}
