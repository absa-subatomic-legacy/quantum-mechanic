import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {inspect} from "util";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {TeamMembershipMessages} from "../../messages/member/TeamMembershipMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {UpdateProjectPipelineRequest} from "../../services/gluon/ProjectService";
import {QMMemberBase} from "../../util/member/Members";
import {QMDeploymentPipeline, QMProject} from "../../util/project/Project";
import {
    GluonProjectNameSetter,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Defines the project associated deployment pipelines using the available default environments")
@Tags("subatomic", "project")
export class DefineNewProjectEnvironments extends BaseQMComand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @Parameter({
        description: "Team Name",
        required: false,
    })
    public teamName: string;

    @Parameter({
        description: "Project Name",
    })
    public projectName: string;

    @Parameter({
        description: "Requested Environments",
    })
    public environmentPostfixes: string;

    public set requestedEnvironments(environmentPostfixes: string []) {
        this.environmentPostfixes = JSON.stringify(environmentPostfixes);
    }

    private teamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Creating new OpenShift environments...");

        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `Requesting project environment's for project *${this.projectName}*`,
            }, destination);

            const member = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            const requestedEnvironmentPostfixes: string[] = JSON.parse(this.environmentPostfixes);

            await this.requestPipelineCreationAndOpenShiftEnvironments(project, member, requestedEnvironmentPostfixes);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async requestPipelineCreationAndOpenShiftEnvironments(project: QMProject, member: QMMemberBase, requestedEnvironmentPostfixes: string []) {

        const projectUpdate: UpdateProjectPipelineRequest = {
            createdBy: member.memberId,
            devDeploymentPipeline: this.getDeploymentPipeline(QMConfig.subatomic.openshiftClouds[project.owningTeam.openShiftCloud].openshiftNonProd, requestedEnvironmentPostfixes.slice(0, requestedEnvironmentPostfixes.length - 1)),
            releaseDeploymentPipelines: [this.getDeploymentPipeline(QMConfig.subatomic.openshiftClouds[project.owningTeam.openShiftCloud].openshiftNonProd, requestedEnvironmentPostfixes.slice(requestedEnvironmentPostfixes.length - 1, requestedEnvironmentPostfixes.length))],
        };

        const projectEnvironmentRequestResult = await this.gluonService.projects.updateProjectPipelines(project.projectId, projectUpdate);
        if (!isSuccessCode(projectEnvironmentRequestResult.status)) {
            if (projectEnvironmentRequestResult.status === 403) {
                throw new QMError(`Member ${member.memberId} is not a member of project ${project.projectId}.`, this.teamMembershipMessages.notAMemberOfTheTeam());
            } else {
                logger.error(`Failed to request project environment for project ${this.projectName}. Error: ${inspect(projectEnvironmentRequestResult)}`);
                throw new QMError("Failed to request project environment. Network error.");
            }
        }
    }

    private getDeploymentPipeline(openshiftNonProd: OpenShiftConfig, environmentPostfixes: string[]) {
        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            environments: [],
        };
        // Add all environments except the last one as per above
        for (const environment of openshiftNonProd.defaultEnvironments) {
            if (environmentPostfixes.some(postfix => environment.id === postfix)) {
                deploymentPipeline.environments.push(
                    {
                        positionInPipeline: deploymentPipeline.environments.length,
                        displayName: environment.description,
                        postfix: environment.id,
                    },
                );
            }
        }
        return deploymentPipeline;
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
