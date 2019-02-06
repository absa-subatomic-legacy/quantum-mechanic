import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import _ = require("lodash");
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

@CommandHandler("Create new OpenShift environments for a project", QMConfig.subatomic.commandPrefix + " request project environments")
@Tags("subatomic", "project", "other")
export class NewProjectEnvironments extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to provision the environments for",
        forceSet: false,
    })
    public teamName: string = null;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the projects you wish to provision the environments for",
    })
    public projectName: string = null;

    private teamMembershipMessages = new TeamMembershipMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Creating new OpenShift environments...");

        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: `Requesting project environment's for project *${this.projectName}*`,
            }, destination);

            const member = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            await this.requestProjectEnvironment(project, member);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async requestProjectEnvironment(project: QMProject, member: QMMemberBase) {
        if (!_.isEmpty(project.devDeploymentPipeline.environments)) {
            logger.info("Project environments are already defined. Requesting existing pipeline creation.");
            await this.requestDefinedPipelineOpenShiftEnvironments(project, member);
        } else {
            logger.info("Project environments are not defined. Requesting default pipeline assignment and creation.");
            await this.requestPipelineCreationAndOpenShiftEnvironments(project, member);
        }
    }

    private async requestDefinedPipelineOpenShiftEnvironments(project: QMProject, member: QMMemberBase) {
        const projectEnvironmentRequestResult = await this.gluonService.projects.requestProjectEnvironment(project.projectId,
            member.memberId,
        );

        if (!isSuccessCode(projectEnvironmentRequestResult.status)) {
            if (projectEnvironmentRequestResult.status === 403) {
                throw new QMError(`Member ${member.memberId} is not a member of project ${project.projectId}.`, this.teamMembershipMessages.notAMemberOfTheTeam());
            } else {
                logger.error(`Failed to request project environment for project ${this.projectName}. Error: ${inspect(projectEnvironmentRequestResult)}`);
                throw new QMError("Failed to request project environment. Network error.");
            }
        }
    }

    private async requestPipelineCreationAndOpenShiftEnvironments(project: QMProject, member: QMMemberBase) {

        const projectUpdate: UpdateProjectPipelineRequest = {
            createdBy: member.memberId,
            devDeploymentPipeline: this.getDefaultDevDeploymentPipeline(QMConfig.subatomic.openshiftClouds[project.owningTeam.openShiftCloud].openshiftNonProd),
            releaseDeploymentPipelines: [this.getDefaultReleaseDeploymentPipeline(QMConfig.subatomic.openshiftClouds[project.owningTeam.openShiftCloud].openshiftNonProd)],
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

    private getDefaultDevDeploymentPipeline(openshiftNonProd: OpenShiftConfig) {
        // The default dev deployment pipeline will consist of all environments
        // except the last one defined in the default environment list
        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            environments: [],
        };
        // Add all environments except the last one as per above
        for (let i = 0; i < openshiftNonProd.defaultEnvironments.length - 1; i++) {
            const environment = openshiftNonProd.defaultEnvironments[i];
            deploymentPipeline.environments.push(
                {
                    positionInPipeline: i,
                    displayName: environment.description,
                    postfix: environment.id,
                },
            );
        }
        return deploymentPipeline;
    }

    private getDefaultReleaseDeploymentPipeline(openshiftNonProd: OpenShiftConfig) {
        // The default release deployment pipeline will consist of a single
        // environment only which will be the last environment defined in the
        // default environment list
        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            environments: [],
        };
        // Take only the last environment
        const environment = openshiftNonProd.defaultEnvironments[openshiftNonProd.defaultEnvironments.length - 1];
        deploymentPipeline.environments.push(
            {
                positionInPipeline: deploymentPipeline.environments.length,
                displayName: environment.description,
                postfix: environment.id,
            },
        );

        return deploymentPipeline;
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
