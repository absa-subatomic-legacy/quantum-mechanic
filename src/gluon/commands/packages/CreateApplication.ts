import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
} from "@atomist/automation-client";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {ApplicationType} from "../../util/packages/Applications";
import {QMProject} from "../../util/project/Project";
import {
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

export class CreateApplication extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @Parameter({
        description: "application name",
    })
    public name: string;

    @Parameter({
        description: "application description",
    })
    public description: string;

    @Parameter({
        description: "Bitbucket repository name",
    })
    public bitbucketRepositoryName: string;

    @Parameter({
        description: "Bitbucket repository URL",
    })
    public bitbucketRepositoryRepoUrl: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to create the Bitbucket project in",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the Bitbucket project you wish to create",
    })
    public projectName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        // get memberId for createdBy
        try {
            await ctx.messageClient.respond({
                text: "🚀 Your new application is being created...",
            });

            const member = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            await this.createApplicationInGluon(project, member);

            const result = await ctx.messageClient.respond({
                text: "🚀 Application created successfully.",
            });
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async createApplicationInGluon(project, member) {
        const createApplicationResult = await this.gluonService.applications.createGluonApplication(
            {
                name: this.name,
                description: this.description,
                applicationType: ApplicationType.DEPLOYABLE,
                projectId: project.projectId,
                createdBy: member,
                bitbucketRepository: {
                    name: this.bitbucketRepositoryName,
                    repoUrl: this.bitbucketRepositoryRepoUrl,
                },
                requestConfiguration: true,
            });

        if (createApplicationResult.status === 409) {
            logger.error(`Failed to create application since the name of the application is already in use.`);
            throw new QMError(`Failed to create application since the name of the application is already in use. Please retry using a different name.`);
        } else if (!isSuccessCode(createApplicationResult.status)) {
            throw new QMError("Your new application could not be created. Please ensure it does not already exist.");
        }
    }
}
