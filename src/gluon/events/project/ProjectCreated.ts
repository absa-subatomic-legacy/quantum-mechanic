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
import {url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {QMColours} from "../../../QMColour";
import {ListExistingBitbucketProject} from "../../commands/bitbucket/BitbucketProject";
import {AssociateTeam} from "../../commands/project/AssociateTeam";
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
                text: `The *${projectCreatedEvent.project.name}* project has been created successfully.`,
                attachments: [{
                    text: `
A Subatomic project is linked to a Bitbucket project. \
This can be a new Bitbucket project that will be created and configured according to best practice or you can choose to link an existing project. The existing project will also be configured accordingly.`,
                    fallback: "Create or link Bitbucket project",
                    footer: `For more information, please read the ${this.docs("create-bitbucket-project")}`,
                    color:  QMColours.stdGreenyMcAppleStroodle.hex,
                    thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/atlassian-bitbucket-logo.png",
                    actions: [
                        buttonForCommand(
                            {text: "Link existing Bitbucket project"},
                            new ListExistingBitbucketProject(), {
                                projectName: projectCreatedEvent.project.name,
                            }),
                    ],
                }, {
                    text: `
Projects can be associated with multiple teams. \
If you would like to associate more teams to the *${projectCreatedEvent.project.name}* project, please use the \`@atomist sub associate team\` command`,
                    fallback: "Associate multiple teams to this project",
                    footer: `For more information, please read the ${this.docs("associate-team")}`,
                    color:  QMColours.stdShySkyBlue.hex,
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

    private docs(extension): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#${extension}`,
            "documentation")}`;
    }
}
