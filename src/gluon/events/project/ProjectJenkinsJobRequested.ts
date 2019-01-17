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
import {SlackMessage, url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {LinkExistingLibrary} from "../../commands/packages/LinkExistingLibrary";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigureJenkinsForProject} from "../../tasks/project/ConfigureJenkinsForProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {QMProject} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";

@EventHandler("Receive ProjectJenkinsJobRequestedEvent events", `
subscription ProjectJenkinsJobRequestedEvent {
  ProjectJenkinsJobRequestedEvent {
    id
    project {
      projectId
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
export class ProjectJenkinsJobRequested extends BaseQMEvent implements HandleEvent<any> {

    private qmMessageClient: ChannelMessageClient;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectJenkinsJobRequested event: ${JSON.stringify(event.data)}`);

        const jenkinsJobRequestedEvent = event.data.ProjectJenkinsJobRequestedEvent[0];

        this.qmMessageClient = this.createMessageClient(ctx, jenkinsJobRequestedEvent.teams);

        try {
            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(jenkinsJobRequestedEvent.project.name);
            const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(project.owningTeam.teamId);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Provisioning of jenkins job for project *${jenkinsJobRequestedEvent.project.name}* started:`,
                this.qmMessageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);
            const openshiftNonProd = QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd;

            taskRunner.addTask(
                new ConfigureJenkinsForProject(jenkinsJobRequestedEvent, project.devDeploymentPipeline, project.releaseDeploymentPipelines, openshiftNonProd),
            );

            await taskRunner.execute(ctx);
            this.succeedEvent();
            return await this.sendPackageUsageMessage(ctx, jenkinsJobRequestedEvent.project.name, jenkinsJobRequestedEvent.teams);
        } catch (error) {
            this.failEvent();
            return await handleQMError(this.qmMessageClient, error);
        }
    }

    private createMessageClient(ctx: HandlerContext, teams) {
        const messageClient = new ChannelMessageClient(ctx);
        teams.map(team => {
            messageClient.addDestination(team.slackIdentity.teamChannel);
        });
        return messageClient;
    }

    private async sendPackageUsageMessage(ctx: HandlerContext, projectName: string, teams) {
        const msg: SlackMessage = {
            text: `
Since you have a project Jenkins Job ready, you can now add libraries to you project. Note that to add an application instead of a library, you need to have openshift environment environments created.`,
            attachments: [{
                fallback: "Create or link existing package",
                footer: `For more information, please read the ${this.docs()}`,
                color: QMColours.stdGreenyMcAppleStroodle.hex,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Link existing library"},
                        new LinkExistingLibrary(),
                        {
                            projectName,
                        }),
                ],
            }],
        };
        const destination = await addressSlackChannelsFromContext(ctx, ...teams.map(team =>
            team.slackIdentity.teamChannel));
        return await ctx.messageClient.send(msg, destination);
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#link-library`,
            "documentation")}`;
    }
}
