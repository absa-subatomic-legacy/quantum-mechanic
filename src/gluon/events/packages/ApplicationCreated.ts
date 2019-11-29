import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {
    addressSlackChannelsFromContext,
    buttonForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {CommandIntent} from "../../commands/CommandIntent";
import {ConfigureBasicPackage} from "../../commands/packages/ConfigureBasicPackage";
import {SetPackageJenkinsFolder} from "../../commands/packages/SetPackageJenkinsFolder";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {QMColours} from "../../util/QMColour";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";

@EventHandler("Receive ApplicationCreatedEvent events", `
subscription ApplicationCreatedEvent {
  ApplicationCreatedEvent {
    id
    application {
      applicationId
      name
      description
      applicationType
    }
    project {
      projectId
      name
      description
    }
    bitbucketRepository {
      bitbucketId
      name
      repoUrl
      remoteUrl
    }
    bitbucketProject {
      id
      key
      name
      description
      url
    }
    owningTeam {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    teams {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
    requestConfiguration
  }
}
`)
export class ApplicationCreated extends BaseQMEvent implements HandleEvent<any> {

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ApplicationCreated event: ${JSON.stringify(event.data)}`);

        try {
            const applicationCreatedEvent = event.data.ApplicationCreatedEvent[0];
            if (applicationCreatedEvent.requestConfiguration === true) {
                return await this.sendConfigurationMessage(ctx, applicationCreatedEvent);
            }

            logger.info(`ApplicationCreated event will not request configuration`);
            this.succeedEvent();
            return await success();
        } catch {
            this.failEvent();
        }
    }

    private async sendConfigurationMessage(ctx: HandlerContext, applicationCreatedEvent) {
        const applicationType = applicationCreatedEvent.application.applicationType.toLowerCase();
        const configurePackageText = `The ${applicationType} can now be configured. This determines what type of ${applicationType} it is and how it should be deployed/built within your environments.`;
        const setJenkinsFolderText = `By default, all Jenkinsfiles will be added to the root of your package's source repository. This can be changed before configuring the package. It is advised to do so if multiple packages share the backing repository.`;
        const destination = await addressSlackChannelsFromContext(ctx, applicationCreatedEvent.owningTeam.slackIdentity.teamChannel);
        return await ctx.messageClient.send({
            text: `The *${applicationCreatedEvent.application.name}* ${applicationType} in the project *${applicationCreatedEvent.project.name}* has been created successfully.`,
            attachments: [{
                text: configurePackageText,
                fallback: configurePackageText,
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.AddMemberToTeam)}`,
                color: QMColours.stdGreenyMcAppleStroodle.hex,
                actions: [
                    buttonForCommand(
                        {text: "Configure Component"},
                        new ConfigureBasicPackage(),
                        {
                            projectName: applicationCreatedEvent.project.name,
                            applicationName: applicationCreatedEvent.application.name,
                            teamName: applicationCreatedEvent.owningTeam.name,
                            screenName: applicationCreatedEvent.requestedBy.slackIdentity.screenName,
                        }),
                ],
            },
                {
                    text: setJenkinsFolderText,
                    fallback: setJenkinsFolderText,
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.SetPackageJenkinsFolder)}`,
                    color: QMColours.stdMuddyYellow.hex,
                    actions: [
                        buttonForCommand(
                            {text: "Set Jenkins Folder"},
                            new SetPackageJenkinsFolder(),
                            {
                                projectName: applicationCreatedEvent.project.name,
                                applicationName: applicationCreatedEvent.application.name,
                                teamName: applicationCreatedEvent.owningTeam.name,
                            }),
                    ],
                },
            ],
        }, destination);
    }

}
