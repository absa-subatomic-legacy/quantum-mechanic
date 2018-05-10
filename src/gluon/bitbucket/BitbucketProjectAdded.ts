import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {url} from "@atomist/slack-messages";
import {QMConfig} from "../../config/QMConfig";
import {NewProjectEnvironments} from "../project/ProjectEnvironments";
import {addBitbucketProjectAccessKeys} from "./BitbucketConfiguration";

@EventHandler("Receive BitbucketProjectAddedEvent events", `
subscription BitbucketProjectAddedEvent {
  BitbucketProjectAddedEvent {
    id
    project {
      projectId
      name
      description
    }
    teams {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    bitbucketProject {
      id
      key
      name
      description
      url
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
export class BitbucketProjectAdded implements HandleEvent<any> {

    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested BitbucketProjectAddedEvent event: ${JSON.stringify(event.data)}`);

        const addedEvent = event.data.BitbucketProjectAddedEvent[0];
        return addBitbucketProjectAccessKeys(addedEvent.bitbucketProject.key)
            .catch(error => {
                logger.error(`Failed to configure Bitbucket Project ${addedEvent.project.name} with error: ${JSON.stringify(error)}`);
                return ctx.messageClient.addressUsers({
                    text: `There was an error adding SSH keys for ${addedEvent.project.name} Bitbucket project`,
                }, addedEvent.createdBy.slackIdentity.screenName);
            }).then(() => {
                return ctx.messageClient.addressChannels({
                    text: `
The *${addedEvent.bitbucketProject.name}* Bitbucket project has been configured successfully and linked to the *${addedEvent.project.name}* Subatomic project.
Click here to view the project in Bitbucket: ${addedEvent.bitbucketProject.url}`,
                    attachments: [
                        {
                            text: `
A Subatomic project is deployed into the OpenShift platform. \
The platform consists of two clusters, an Non Prod and a Prod cluster. The project environments span both clusters and are the deployment targets for the applications managed by Subatomic.
These environments are realised as OpenShift projects and need to be created or linked to existing projects. If you haven't done either, please do that now.`,
                            fallback: "Create or link existing OpenShift environments",
                            footer: `For more information, please read the ${this.docs()}`,
                            color: "#45B254",
                            actions: [
                                buttonForCommand(
                                    {text: "Create OpenShift environments"},
                                    new NewProjectEnvironments(),
                                    {
                                        projectName: addedEvent.project.name,
                                    }),
                            ],
                        },
                        {
                            text: `
Projects can be associated with multiple teams. \
If you would like to associate more teams to the *${addedEvent.project.name}* project, please use the \`@atomist subatomic associate team\` command`,
                            fallback: "Associate multiple teams to this project",
                            footer: `For more information, please read the ${this.docs()}`,
                            color: "#00a5ff",
                        }],
                }, addedEvent.teams.map(team => team.slackIdentity.teamChannel));
            });
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/projects#bitbucket`,
            "documentation")}`;
    }
}
