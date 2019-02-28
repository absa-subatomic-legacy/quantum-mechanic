import {
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
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

@CommandHandler("Link an existing Bitbucket project", QMConfig.subatomic.commandPrefix + " link bitbucket project")
@Tags("subatomic", "bitbucket", "project")
export class LinkExistingBitbucketProject
    extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @MappedParameter(MappedParameters.SlackUser)
    public slackName: string;

    @Parameter({
        description: "bitbucket project key",
    })
    public bitbucketProjectKey: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to create a Bitbucket project for",
        forceSet: false,
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the project you wish to link a Bitbucket project to",
    })
    public projectName: string;

    constructor(public gluonService = new GluonService(),
                private bitbucketService = new BitbucketService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            return await this.configBitbucket(ctx);
        } catch (error) {
            return await this.handleError(ctx, error);
        }
    }

    private async configBitbucket(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            logger.info(`Team: ${this.teamName}, Project: ${this.projectName}`);

            const member = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);
            const gluonProject: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            const projectUiUrl = `${QMConfig.subatomic.bitbucket.baseUrl}/projects/${this.bitbucketProjectKey}`;

            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `🚀 The Bitbucket project with key ${this.bitbucketProjectKey} is being configured...`,
            }, destination);

            const bitbucketProject = await this.getBitbucketProject(this.bitbucketProjectKey);

            await this.updateGluonProjectWithBitbucketDetails(projectUiUrl, member.memberId, gluonProject.projectId, bitbucketProject);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
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

    private async updateGluonProjectWithBitbucketDetails(bitbucketProjectUiUrl: string, createdByMemberId: string, gluonProject, bitbucketProject) {
        const updateGluonProjectResult = await this.gluonService.projects.updateProjectWithBitbucketDetails(gluonProject,
            {
                bitbucketProject: {
                    bitbucketProjectId: bitbucketProject.id,
                    name: bitbucketProject.name,
                    description: bitbucketProject.description,
                    key: this.bitbucketProjectKey,
                    url: bitbucketProjectUiUrl,
                },
                createdBy: createdByMemberId,
            });

        if (!isSuccessCode(updateGluonProjectResult.status)) {
            let message = `Failed to link Bitbucket project. ${updateGluonProjectResult.data}`;
            logger.error(message);
            if (updateGluonProjectResult.status === 403) {
                message = `Unauthorized: Sorry only a team member can link a Bitbucket project`;
            }
            throw new QMError(message);
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        const messageClient = new ResponderMessageClient(ctx);
        return await handleQMError(messageClient, error);
    }
}
