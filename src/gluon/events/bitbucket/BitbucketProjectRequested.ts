import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {isSuccessCode} from "../../../http/Http";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigureBitbucketProjectRecommendedPractices} from "../../tasks/bitbucket/ConfigureBitbucketProjectRecommendedPractices";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {QMProjectBase} from "../../util/project/Project";
import {
    ChannelMessageClient,
    handleQMError,
    QMError,
} from "../../util/shared/Error";

@EventHandler("Receive BitbucketProjectRequestedEvent events", `
subscription BitbucketProjectRequestedEvent {
  BitbucketProjectRequestedEvent {
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
      owners {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
      members {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
    }
    bitbucketProjectRequest {
      key
      name
      description
    }
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class BitbucketProjectRequested implements HandleEvent<any> {

    private bitbucketProjectId: string;

    private bitbucketProjectUrl: string;

    constructor(private bitbucketService = new BitbucketService(), private gluonService = new GluonService()) {
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested BitbucketProjectRequested event: ${JSON.stringify(event.data)}`);

        const bitbucketProjectRequestedEvent = event.data.BitbucketProjectRequestedEvent[0];

        const messageClient = new ChannelMessageClient(ctx);

        bitbucketProjectRequestedEvent.teams
            .filter(team => team.slackIdentity !== undefined)
            .forEach(team => messageClient.addDestination(team.slackIdentity.teamChannel));

        try {

            const project = bitbucketProjectRequestedEvent.project;

            const qmProject: QMProjectBase = {
                projectId: project.projectId,
                name: project.name,
                bitbucketProject: bitbucketProjectRequestedEvent.bitbucketProjectRequest,
            };

            await this.createBitbucketProject(qmProject.bitbucketProject.key, qmProject.bitbucketProject.name, qmProject.bitbucketProject.description);

            const taskListMessage: TaskListMessage = new TaskListMessage(":rocket: Configuring Bitbucket Project...", messageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            for (const team of bitbucketProjectRequestedEvent.teams) {
                taskRunner.addTask(
                    new ConfigureBitbucketProjectRecommendedPractices(team, qmProject, this.bitbucketService),
                );
            }

            await taskRunner.execute(ctx);

            return await this.confirmBitbucketProjectCreatedWithGluon(bitbucketProjectRequestedEvent.project.projectId, bitbucketProjectRequestedEvent.project.name);
        } catch (error) {
            return await handleQMError(messageClient, error);
        }
    }

    private async createBitbucketProject(projectKey: string, projectName: string, projectDescription: string) {
        const createBitbucketProjectRequest = await this.bitbucketService.createBitbucketProject(
            {
                projectKey,
                projectName,
                projectDescription,
            });

        if (isSuccessCode(createBitbucketProjectRequest.status)) {
            const project = createBitbucketProjectRequest.data;
            logger.info(`Created project: ${JSON.stringify(project)} -> ${project.id} + ${project.links.self[0].href}`);
            this.bitbucketProjectId = project.id;
            this.bitbucketProjectUrl = project.links.self[0].href;
        } else {
            logger.warn(`Error creating project: ${createBitbucketProjectRequest.status}`);
            if (createBitbucketProjectRequest.status === 201 || createBitbucketProjectRequest.status === 409) {
                logger.warn(`Project probably already exists.`);
                const bitbucketProject = await this.getBitbucketProject(projectKey);
                this.bitbucketProjectId = bitbucketProject.id;
                this.bitbucketProjectUrl = bitbucketProject.links.self[0].href;
            } else {
                logger.error(`Failed to create bitbucket project. Error ${JSON.stringify(createBitbucketProjectRequest)}`);
                throw new QMError(`Failed to create bitbucket project. Bitbucket rejected the request.`);
            }
        }
    }

    private async getBitbucketProject(bitbucketProjectKey: string) {
        const bitbucketProjectRequestResult = await this.bitbucketService.bitbucketProjectFromKey(
            bitbucketProjectKey,
        );

        if (!isSuccessCode(bitbucketProjectRequestResult.status)) {
            throw new QMError("Unable to find the specified project in Bitbucket. Please make sure it exists.");
        }

        return bitbucketProjectRequestResult.data;
    }

    private async confirmBitbucketProjectCreatedWithGluon(projectId: string, projectName: string) {
        logger.info(`Confirming Bitbucket project: [${this.bitbucketProjectId}-${this.bitbucketProjectUrl}]`);
        const confirmBitbucketProjectCreatedResult = await this.gluonService.projects.confirmBitbucketProjectCreated(projectId,
            {
                bitbucketProject: {
                    bitbucketProjectId: this.bitbucketProjectId,
                    url: this.bitbucketProjectUrl,
                },
            });
        if (!isSuccessCode(confirmBitbucketProjectCreatedResult.status)) {
            logger.error(`Could not confirm Bitbucket project: [${confirmBitbucketProjectCreatedResult.status}-${confirmBitbucketProjectCreatedResult.data}]`);
            throw new QMError(`There was an error confirming the ${projectName} Bitbucket project details`);
        }
        return success();
    }
}
