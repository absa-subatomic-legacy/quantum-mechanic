import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {ConfigureApplication} from "./ConfigureApplication";

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
export class ApplicationCreated implements HandleEvent<any> {

    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ApplicationCreated event: ${JSON.stringify(event.data)}`);

        const applicationCreatedEvent = event.data.ApplicationCreatedEvent[0];
        if (applicationCreatedEvent.requestConfiguration === true) {
            const configureApplication = new ConfigureApplication();
            configureApplication.projectName = applicationCreatedEvent.project.name;
            configureApplication.applicationName = applicationCreatedEvent.application.name;
            configureApplication.screenName = applicationCreatedEvent.requestedBy.slackIdentity.screenName;
            return configureApplication.handle(ctx);
        }

        logger.info(`ApplicationCreated event requested no configuration`);

        return Promise.resolve(success());
    }
}
