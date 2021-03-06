import {
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {GluonService} from "../../services/gluon/GluonService";
import {QMColours} from "../../util/QMColour";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {
    handleQMError,
    logErrorAndReturnSuccess,
    } from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("List projects belonging to a team", atomistIntent(CommandIntent.ListTeamProjects))
@Tags("subatomic", "project", "team")
export class ListTeamProjects extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team you wish to list associated projects for",
    })
    public teamName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            return await this.listTeamProjects(ctx, this.teamName);
        } catch (error) {
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async listTeamProjects(ctx: HandlerContext, teamName: string): Promise<HandlerResult> {

        try {
            const projects = await this.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(teamName);

            const attachments = [];

            for (const project of projects) {

                const parameters = {
                    projectId: project.projectId,
                    projectName: project.name,
                    projectDescription: project.description,
                    projectBitbucketKey: null,
                };

                if (project.bitbucketProject !== null) {
                    parameters.projectBitbucketKey = project.bitbucketProject.key;
                }

                attachments.push(
                    {
                        text: `*Project:* ${project.name}\n*Description:* ${project.description}`,
                        color: QMColours.stdGreenyMcAppleStroodle.hex,
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Show More",
                                },
                                new ListProjectDetails(),
                                parameters,
                            ),
                        ],
                    },
                );
            }

            const msg: SlackMessage = {
                text: `The following projects are linked to the team *${teamName}*. Click on the "Show More" button to learn more about a particular project.`,
                attachments,
            };

            const result = await ctx.messageClient.respond(msg);
            this.succeedCommand();
            return result;
        } catch (error) {
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}

@CommandHandler("List project details")
export class ListProjectDetails extends BaseQMComand implements HandleCommand<HandlerResult> {

    @Parameter({
        description: "project",
        required: false,
        displayable: false,
    })
    public projectId: string;

    @Parameter({
        description: "project",
        required: false,
        displayable: false,
    })
    public projectName: string;

    @Parameter({
        description: "project",
        required: false,
        displayable: false,
    })
    public projectDescription: string;

    @Parameter({
        description: "project",
        required: false,
        displayable: false,
    })
    public projectBitbucketKey: string;

    constructor(private gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            let applications;
            try {
                applications = await this.gluonService.applications.gluonApplicationsLinkedToGluonProjectId(this.projectId);
            } catch (error) {
                return await logErrorAndReturnSuccess(this.gluonService.applications.gluonApplicationsLinkedToGluonProjectId.name, error);
            }

            let bitbucketURL = "None";
            if (this.projectBitbucketKey !== null) {
                bitbucketURL = `${QMConfig.subatomic.bitbucket.baseUrl}/projects/${this.projectBitbucketKey}`;
            }
            const attachments = [];
            for (const application of applications) {
                let applicationBitbucketUrl = "None";
                if (application.bitbucketRepository !== null) {
                    applicationBitbucketUrl = application.bitbucketRepository.repoUrl;
                }
                attachments.push(
                    {
                        text: `*Application:* ${application.name}\n*Description:* ${application.description}\n*Bitbucket URL:* ${applicationBitbucketUrl}`,
                        color: QMColours.stdGreenyMcAppleStroodle.hex,
                    },
                );
            }

            let headerMessage = `The current details of the project *${this.projectName}* are as follows.\n*Description:* ${this.projectDescription}\n*Bitbucket URL:* ${bitbucketURL}\n`;

            if (attachments.length > 0) {
                headerMessage += "The below applications belong to the project:";
            } else {
                headerMessage += "There are no applications that belong to this project yet";
            }

            const msg: SlackMessage = {
                text: headerMessage,
                attachments,
            };
            const result = await ctx.messageClient.respond(msg);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
