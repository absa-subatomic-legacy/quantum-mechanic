import {
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {SlackMessage} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {LinkExistingLibrary} from "../../commands/packages/LinkExistingLibrary";
import {CommandDocumentationLink} from "../../messages/documentation/CommandDocumentationLink";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigureJenkinsForProject} from "../../tasks/project/ConfigureJenkinsForProject";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {
    OpenshiftProjectEnvironmentRequest,
    QMProject,
} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";
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
    owningTeam {
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

        this.qmMessageClient = new ChannelMessageClient(ctx).addDestination(jenkinsJobRequestedEvent.owningTeam.slackIdentity.teamChannel);

        try {
            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(jenkinsJobRequestedEvent.project.name);
            const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(project.owningTeam.teamId);
            const owningTenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

            const taskListMessage: TaskListMessage = new TaskListMessage(`🚀 Provisioning of jenkins job for project *${jenkinsJobRequestedEvent.project.name}* started:`,
                this.qmMessageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);
            const openshiftNonProd = QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd;

            const jenkinsProjectDetails: OpenshiftProjectEnvironmentRequest = {
                project,
                owningTenant,
                teams: [jenkinsJobRequestedEvent.owningTeam],
            };

            taskRunner.addTask(
                new ConfigureJenkinsForProject(jenkinsProjectDetails, project.devDeploymentPipeline, project.releaseDeploymentPipelines, openshiftNonProd),
            );

            await taskRunner.execute(ctx);
            this.succeedEvent();
            return await this.sendPackageUsageMessage(this.qmMessageClient, jenkinsJobRequestedEvent.project.name);
        } catch (error) {
            this.failEvent();
            return await handleQMError(this.qmMessageClient, error);
        }
    }

    private async sendPackageUsageMessage(qmMessageClient: QMMessageClient, projectName: string) {
        const msg: SlackMessage = {
            text: `
Since you have a project Jenkins project folder ready, you can now add libraries to you project. Note that to add an application instead of a library, you need to have OpenShift environments created.`,
            attachments: [{
                fallback: "Create or link existing package",
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandDocumentationLink.LinkExistingLibrary)}`,
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
        return await qmMessageClient.send(msg);
    }
}
