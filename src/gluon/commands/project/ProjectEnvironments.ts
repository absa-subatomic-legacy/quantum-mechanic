import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {MemberService} from "../../util/member/Members";
import {
    menuForProjects,
    ProjectService,
} from "../../util/project/ProjectService";
import {
    handleQMError,
    logErrorAndReturnSuccess,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {isSuccessCode} from "../../util/shared/Http";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/shared/RecursiveParameterRequestCommand";
import {menuForTeams, TeamService} from "../../util/team/TeamService";

@CommandHandler("Create new OpenShift environments for a project", QMConfig.subatomic.commandPrefix + " request project environments")
@Tags("subatomic", "openshift", "project")
export class NewProjectEnvironments extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @RecursiveParameter({
        description: "project name",
    })
    public projectName: string = null;

    @Parameter({
        description: "team name",
        displayable: false,
        required: false,
    })
    public teamName: string = null;

    constructor(private teamService = new TeamService(),
                private projectService = new ProjectService(),
                private memberService = new MemberService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        logger.info("Creating new OpenShift environments...");

        try {
            await ctx.messageClient.addressChannels({
                text: `Requesting project environment's for project *${this.projectName}*`,
            }, this.teamChannel);

            const member = await this.memberService.gluonMemberFromScreenName(this.screenName);

            let project;
            try {
                project = await this.projectService.gluonProjectFromProjectName(ctx, this.projectName);
            } catch (error) {
                return await logErrorAndReturnSuccess(this.projectService.gluonProjectFromProjectName.name, error);
            }

            await this.requestProjectEnvironment(project.projectId, member.memberId);

            return await success();
        } catch (error) {
            return await this.handleError(ctx, error);
        }
    }

    protected async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await this.teamService.gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
                return await this.handle(ctx);
            } catch (error) {
                const teams = await this.teamService.gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
                return await menuForTeams(
                    ctx,
                    teams,
                    this,
                    "Please select a team associated with the project you wish to provision the environments for",
                );
            }
        }
        if (_.isEmpty(this.projectName)) {
            const projects = await this.projectService.gluonProjectsWhichBelongToGluonTeam(ctx, this.teamName);
            return await menuForProjects(
                ctx,
                projects,
                this,
                "Please select the projects you wish to provision the environments for",
            );
        }
    }

    private async requestProjectEnvironment(projectId: string, memberId: string) {
        const projectEnvironmentRequestResult = await this.projectService.requestProjectEnvironment(projectId,
            memberId,
        );

        if (!isSuccessCode(projectEnvironmentRequestResult.status)) {
            logger.error(`Failed to request project environment for project ${this.projectName}. Error: ${JSON.stringify(projectEnvironmentRequestResult)}`);
            throw new QMError("Failed to request project environment. Network error.");
        }
    }

    private async handleError(ctx: HandlerContext, error) {
        return await handleQMError(new ResponderMessageClient(ctx), error);
    }
}
