import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {ChannelMessageClient} from "../../../context/QMMessageClient";
import {BitbucketProjectRecommendedPracticesCommand} from "../../commands/bitbucket/BitbucketProjectRecommendedPracticesCommand";
import {CommandIntent} from "../../commands/CommandIntent";
import {AssociateTeam} from "../../commands/project/AssociateTeam";
import {CreateProjectJenkinsJob} from "../../commands/project/CreateProjectJenkinsJob";
import {RequestProjectEnvironments} from "../../commands/project/request-project-environments/RequestProjectEnvironments";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {ConfigureBitbucketProjectAccess} from "../../tasks/bitbucket/ConfigureBitbucketProjectAccess";
import {TaskListMessage} from "../../tasks/TaskListMessage";
import {TaskRunner} from "../../tasks/TaskRunner";
import {QMProjectBase} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {handleQMError} from "../../util/shared/Error";

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
export class BitbucketProjectAdded extends BaseQMEvent implements HandleEvent<any> {

    constructor(private bitbucketService = new BitbucketService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested BitbucketProjectAddedEvent event: ${JSON.stringify(event.data)}`);

        const bitbucketProjectAddedEvent = event.data.BitbucketProjectAddedEvent[0];

        const messageClient = new ChannelMessageClient(ctx);

        bitbucketProjectAddedEvent.teams
            .filter(team => team.slackIdentity !== undefined)
            .forEach(team => messageClient.addDestination(team.slackIdentity.teamChannel));

        try {

            const project = bitbucketProjectAddedEvent.project;

            const qmProject: QMProjectBase = {
                projectId: project.projectId,
                description: project.description,
                name: project.name,
                bitbucketProject: bitbucketProjectAddedEvent.bitbucketProject,
                owningTenant: project.owningTenant,
            };

            const taskListMessage: TaskListMessage = new TaskListMessage(":rocket: Configuring Bitbucket Project Access...", messageClient);
            const taskRunner: TaskRunner = new TaskRunner(taskListMessage);

            for (const team of bitbucketProjectAddedEvent.teams) {
                taskRunner.addTask(
                    new ConfigureBitbucketProjectAccess(team, qmProject, this.bitbucketService),
                );
            }

            await taskRunner.execute(ctx);

            return await messageClient.send(this.getBitbucketAddedSuccessfullyMessage(bitbucketProjectAddedEvent));

        } catch (error) {
            this.failEvent();
            return await handleQMError(messageClient, error);
        }
    }

    private getBitbucketAddedSuccessfullyMessage(bitbucketAddedEvent) {

        const associateTeamCommand: AssociateTeam = new AssociateTeam();
        associateTeamCommand.projectName = bitbucketAddedEvent.project.name;

        this.succeedEvent();
        return {
            text: `
The *${bitbucketAddedEvent.bitbucketProject.name}* Bitbucket project has been configured successfully and linked to the *${bitbucketAddedEvent.project.name}* Subatomic project.
Click here to view the project in Bitbucket: ${bitbucketAddedEvent.bitbucketProject.url}`,
            attachments: [
                {
                    text: `
Subatomic projects and applications are deployed into an OpenShift cloud. \
An OpenShift cloud consists of a Non Prod cluster and multiple Prod clusters. The project environments span all clusters and are the deployment targets for the applications managed by Subatomic. \
These environments are realised as OpenShift projects and need to be created or linked to existing Subatomic projects.
If you want to create deployable applications in this project you need to create or link these OpenShift environments. This will also configure a jenkins build folder for the project.`,
                    fallback: "Create or link existing OpenShift environments",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.RequestProjectEnvironments)}`,
                    color: QMColours.stdGreenyMcAppleStroodle.hex,
                    thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/openshift-logo.png",
                    actions: [
                        buttonForCommand(
                            {text: "Create OpenShift environments"},
                            new RequestProjectEnvironments(),
                            {
                                projectName: bitbucketAddedEvent.project.name,
                            }),
                    ],
                },
                {
                    text: `
If you plan on having only libraries in this project, it is not necessary to create the related OpenShift environments. In this case you only need to configure a Jenkins build folder for this project.`,
                    fallback: "Configure project in Jenkins",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.CreateProjectJenkinsJob)}`,
                    color: QMColours.stdMuddyYellow.hex,
                    actions: [
                        buttonForCommand(
                            {text: "Configure project in Jenkins"},
                            new CreateProjectJenkinsJob(),
                            {
                                projectName: bitbucketAddedEvent.project.name,
                            }),
                    ],
                },
                {
                    text: `
You can apply recommended practice settings to your bitbucket project. \
This includes setting team owners as default reviewers, adding pre-merge hooks, and protecting master from direct commits. \
These can be manually changed if you wish to change the settings after applying them.\
If you would like to configure the Bitbucket Project associated to the *${bitbucketAddedEvent.project.name}* project, please click the button below.`,
                    fallback: "Apply recommended practices to this bitbucket project",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.BitbucketProjectRecommendedPracticesCommand)}`,
                    color: QMColours.stdShySkyBlue.hex,
                    actions: [
                        buttonForCommand(
                            {
                                text: "Apply recommended practices",
                            },
                            new BitbucketProjectRecommendedPracticesCommand(),
                            {
                                projectName: bitbucketAddedEvent.project.name,
                            }),
                    ],
                },
                {
                    text: `
Projects can be associated with multiple teams. \
If you would like to associate more teams to the *${bitbucketAddedEvent.project.name}* project, please click the button below`,
                    fallback: "Associate multiple teams to this project",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.BitbucketProjectRecommendedPracticesCommand)}`,
                    color: QMColours.stdShySkyBlue.hex,
                    actions: [
                        buttonForCommand(
                            {
                                text: "Associate team",
                            },
                            associateTeamCommand),
                    ],
                }],
        };
    }

}
