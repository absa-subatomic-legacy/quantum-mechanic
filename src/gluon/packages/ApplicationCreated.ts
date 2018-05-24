import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import _ = require("lodash");
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
            if (!_.isEmpty(applicationCreatedEvent.owningTeam.slackIdentity)) {
                const configureApplication = new ConfigureApplication();
                configureApplication.projectName = applicationCreatedEvent.project.name;
                configureApplication.applicationName = applicationCreatedEvent.application.name;
                configureApplication.screenName = applicationCreatedEvent.requestedBy.slackIdentity.screenName;
                configureApplication.teamChannel = applicationCreatedEvent.owningTeam.slackIdentity.teamChannel;
                return configureApplication.handle(ctx);
            } else {
                logger.error("Team has no associated slack identity so not configuration can be performed.");
            }
        }

        logger.info(`ApplicationCreated event will not request configuration`);

        return Promise.resolve(success());
    }
}
