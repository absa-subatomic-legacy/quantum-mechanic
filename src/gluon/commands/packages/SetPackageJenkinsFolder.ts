import {
    buttonForCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
    success,
} from "@atomist/automation-client";
import {CommandHandler, Tags} from "@atomist/automation-client/lib/decorators";
import {
    AtomistQMMessageClient,
    QMMessageClient,
} from "../../../context/QMMessageClient";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {TeamMembershipMessages} from "../../messages/member/TeamMembershipMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {QMColours} from "../../util/QMColour";
import {
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {isUserAMemberOfTheTeam} from "../../util/team/Teams";
import {QMApplication} from "../../util/transform/types/gluon/Application";
import {QMProject} from "../../util/transform/types/gluon/Project";
import {QMTeam} from "../../util/transform/types/gluon/Team";
import {atomistIntent, CommandIntent} from "../CommandIntent";
import {ConfigureBasicPackage} from "./ConfigureBasicPackage";

@CommandHandler("Set the Jenkins Folder to use for a Packages Jenkinsfiles", atomistIntent(CommandIntent.SetPackageJenkinsFolder))
@Tags("subatomic", "package", "jenkins")
export class SetPackageJenkinsFolder extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @GluonApplicationNameParam({
        callOrder: 2,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @Parameter({
        description: "jenkins folder, (use . for root, separate paths with a /)",
    })
    public jenkinsFolder: string;

    private teamMembershipMessages: TeamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService(),
                public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        const messageClient: QMMessageClient = new AtomistQMMessageClient(ctx);
        try {
            await this.setApplicationJenkinsFolder(messageClient);
            this.succeedCommand();
            return success();
        } catch (error) {
            this.failCommand();
            return await handleQMError(messageClient.createResponderMessageClient(), error);
        }
    }

    private async setApplicationJenkinsFolder(messageClient: QMMessageClient): Promise<HandlerResult> {

        const responderMessageClient = messageClient.createResponderMessageClient();

        const team: QMTeam = await this.gluonService.teams.getTeamByName(this.teamName);

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const application: QMApplication = await this.gluonService.applications.gluonApplicationForNameAndProjectName(this.applicationName, this.projectName);

        const member = await this.gluonService.members.gluonMemberFromSlackUserId(this.slackUserId);

        if (!isUserAMemberOfTheTeam(member, team)) {
            return await responderMessageClient.send(this.teamMembershipMessages.notAMemberOfTheTeam());
        }

        await this.gluonService.applications.setApplicationJenkinsFolder(application.applicationId, this.jenkinsFolder);

        const channelMessageClient = messageClient.createChannelMessageClient();

        channelMessageClient.addDestination(team.slack.teamChannel);

        const attachmentText = `The package can now be configured. This determines what type of package it is and how it should be deployed/built within your environments.`;

        return await channelMessageClient.send(
            {
                text: `The *${application.name}* package in the project *${project.name}* has been created successfully.`,
                attachments: [{
                    text: attachmentText,
                    fallback: attachmentText,
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.AddMemberToTeam)}`,
                    color: QMColours.stdGreenyMcAppleStroodle.hex,
                    actions: [
                        buttonForCommand(
                            {text: "Configure Component"},
                            new ConfigureBasicPackage(),
                            {
                                projectName: project.name,
                                applicationName: application.name,
                                teamName: team.name,
                            }),
                    ],
                }],
            },
        );
    }
}
