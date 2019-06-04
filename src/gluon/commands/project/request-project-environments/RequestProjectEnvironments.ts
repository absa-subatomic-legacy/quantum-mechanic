import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import _ = require("lodash");
import {inspect} from "util";
import {QMConfig} from "../../../../config/QMConfig";
import {
    SimpleQMMessageClient,
} from "../../../../context/QMMessageClient";
import {ChannelMessageClient} from "../../../../context/QMMessageClient";
import {isSuccessCode} from "../../../../http/Http";
import {TeamMembershipMessages} from "../../../messages/member/TeamMembershipMessages";
import {GluonService} from "../../../services/gluon/GluonService";
import {QMMemberBase} from "../../../util/member/Members";
import {QMProject} from "../../../util/project/Project";
import {
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    } from "../../../util/shared/Error";
import {DefinePipelineMessages} from "./DefinePipelineMessages";

@CommandHandler("Create new OpenShift environments for a project", QMConfig.subatomic.commandPrefix + " request project environments")
@Tags("subatomic", "project", "other")
export class RequestProjectEnvironments extends RecursiveParameterRequestCommand
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

    private definePipelineMessage = new DefinePipelineMessages();

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Creating new OpenShift environments...");

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const messageClient: SimpleQMMessageClient = new ChannelMessageClient(ctx).addDestination(project.owningTeam.slack.teamChannel);

        try {
            await messageClient.send({
                text: `Requesting project environment's for project *${this.projectName}*`,
            });

            const member = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

            if (_.isEmpty(project.devDeploymentPipeline.environments)) {
                logger.info("Project environments are not defined. Requesting default pipeline assignment and creation.");
                return await messageClient.send(this.definePipelineMessage.selectPipelineDefinition(project.owningTeam.name, project.name, QMConfig.subatomic.openshiftClouds[project.owningTeam.openShiftCloud].openshiftNonProd));
            }

            logger.info("Project environments are already defined. Requesting existing pipeline creation.");
            await this.requestDefinedPipelineOpenShiftEnvironments(project, member);

            this.succeedCommand();
            return await success();
        } catch (error) {
            this.failCommand();
            return await handleQMError(messageClient, error);
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
}
