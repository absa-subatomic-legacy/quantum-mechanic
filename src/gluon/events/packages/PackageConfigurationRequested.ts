import {
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {SlackMessage, url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {KickOffJenkinsBuild} from "../../commands/jenkins/JenkinsBuild";
import {QMApplication} from "../../services/gluon/ApplicationService";
import {GluonService} from "../../services/gluon/GluonService";
import {ConfigurePackageInJenkins} from "../../tasks/packages/ConfigurePackageInJenkins";
import {ConfigurePackageInOpenshift} from "../../tasks/packages/ConfigurePackageInOpenshift";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {ApplicationType} from "../../util/packages/Applications";
import {QMProject} from "../../util/project/Project";
import {ParameterDisplayType} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient, QMMessageClient} from "../../util/shared/Error";
import {ActionedByEvent} from "../../util/transform/types/event/ActionedByEvent";
import {GluonApplicationEvent} from "../../util/transform/types/event/GluonApplicationEvent";
import {KeyValuePairEvent} from "../../util/transform/types/event/KeyValuePairEvent";
import {ProjectEvent} from "../../util/transform/types/event/ProjectEvent";

@EventHandler("Receive PackageConfigurationRequested events", `
subscription PackageConfigurationRequestedEvent {
  PackageConfigurationRequestedEvent {
    id
    application {
      name
    }
    project {
      name
    }
    imageName
    openshiftTemplate
    jenkinsfileName
    buildEnvironmentVariables{
        key
        value
    }
    deploymentEnvironmentVariables{
        key
        value
    }
    actionedBy{
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class PackageConfigurationRequested extends BaseQMEvent implements HandleEvent<any> {

    constructor(private gluonService: GluonService = new GluonService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested PackageConfigurationRequested event: ${JSON.stringify(event.data)}`);
        const packageConfigurationRequestedEvent: PackageConfigurationRequestedEvent = event.data.PackageConfigurationRequestedEvent[0];
        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(packageConfigurationRequestedEvent.project.name);
        const messageClient: QMMessageClient = new ChannelMessageClient(ctx).addDestination(project.owningTeam.slack.teamChannel);
        try {

            await this.configurePackage(ctx, messageClient, packageConfigurationRequestedEvent);
            this.succeedEvent();
            return await success();
        } catch {
            this.failEvent();
        }
    }

    private async configurePackage(ctx: HandlerContext, messageClient: QMMessageClient, packageConfigurationEvent: PackageConfigurationRequestedEvent): Promise<HandlerResult> {
        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(packageConfigurationEvent.project.name);

        const application: QMApplication = await this.gluonService.applications.gluonApplicationForNameAndProjectName(packageConfigurationEvent.application.name, project.name);

        const taskListMessage = new TaskListMessage(`:rocket: Configuring package *${application.name}*...`, messageClient);
        const taskRunner = new TaskRunner(taskListMessage);
        if (application.applicationType === ApplicationType.DEPLOYABLE.toString()) {
            taskRunner.addTask(
                new ConfigurePackageInOpenshift(
                    {
                        buildEnvironmentVariables: packageConfigurationEvent.buildEnvironmentVariables,
                        openshiftTemplate: packageConfigurationEvent.openshiftTemplate,
                        baseS2IImage: packageConfigurationEvent.imageName,
                        deploymentEnvironmentVariables: packageConfigurationEvent.deploymentEnvironmentVariables,
                    },
                    {
                        teamName: project.owningTeam.name,
                        projectName: project.name,
                        packageName: application.name,
                        packageType: application.applicationType,
                        bitbucketRepoRemoteUrl: application.bitbucketRepository.remoteUrl,
                        owningTeamName: project.owningTeam.name,
                    },
                ),
                "Configure Package in OpenShift",
            );
        }

        taskRunner.addTask(
            new ConfigurePackageInJenkins(
                application,
                project,
                packageConfigurationEvent.jenkinsfileName),
            "Configure Package in Jenkins",
        );

        await taskRunner.execute(ctx);

        return await this.sendPackageProvisionedMessage(messageClient, application.name, project.name, ApplicationType[application.applicationType]);

    }

    private async sendPackageProvisionedMessage(messageClient: QMMessageClient, applicationName: string, projectName: string, applicationType: ApplicationType) {

        const returnableSuccessMessage = this.getDefaultSuccessMessage(applicationName, projectName, applicationType);

        return await messageClient.send(returnableSuccessMessage);
    }

    private getDefaultSuccessMessage(applicationName: string, projectName: string, applicationType: ApplicationType): SlackMessage {
        let packageTypeString = "application";
        if (applicationType === ApplicationType.LIBRARY) {
            packageTypeString = "library";
        }

        return {
            text: `Your ${packageTypeString} *${applicationName}*, in project *${projectName}*, has been provisioned successfully ` +
                "and is ready to build/deploy",
            attachments: [{
                fallback: `Your ${packageTypeString} has been provisioned successfully`,
                footer: `For more information, please read the ${this.docs() + "#jenkins-build"}`,
                text: `
You can kick off the build pipeline for your ${packageTypeString} by clicking the button below or pushing changes to your ${packageTypeString}'s repository`,
                mrkdwn_in: ["text"],
                actions: [
                    buttonForCommand(
                        {
                            text: "Start build",
                            style: "primary",
                        },
                        new KickOffJenkinsBuild(),
                        {
                            projectName,
                            applicationName,
                            displayResultMenu: ParameterDisplayType.hide,
                        }),
                ],
            }],
        };
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference`,
            "documentation")}`;
    }
}

export interface PackageConfigurationRequestedEvent {
    application: GluonApplicationEvent;
    project: ProjectEvent;
    imageName: string;
    openshiftTemplate: string;
    jenkinsfileName: string;
    buildEnvironmentVariables: KeyValuePairEvent[];
    deploymentEnvironmentVariables: KeyValuePairEvent[];
    actionedBy: ActionedByEvent;
}
