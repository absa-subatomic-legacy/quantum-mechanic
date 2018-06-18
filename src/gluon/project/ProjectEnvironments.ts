import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter, success,
    Tags,
} from "@atomist/automation-client";
import axios from "axios";
import _ = require("lodash");
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {RecursiveParameter, RecursiveParameterRequestCommand} from "../shared/RecursiveParameterRequestCommand";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo, menuForTeams,
} from "../team/Teams";
import {
    gluonProjectFromProjectName,
    gluonProjectsWhichBelongToGluonTeam, menuForProjects,
} from "./Projects";

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

    protected async runCommand(ctx: HandlerContext) {
        logger.info("Creating new OpenShift environments...");

        let member;
        try {
            member = await gluonMemberFromScreenName(ctx, this.screenName);
        } catch (error) {
            return await logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
        }

        let project;
        try {
            project = await gluonProjectFromProjectName(ctx, this.projectName);
        } catch (error) {
            return await logErrorAndReturnSuccess(gluonProjectFromProjectName.name, error);
        }

        const projectEnvironmentRequestResult = await this.requestProjectEnvironment(project.projectId, member.memberId);

        if (projectEnvironmentRequestResult.status !== 200) {
            logger.error(`Failed to request project environment for project ${this.projectName}. Error: ${JSON.stringify(projectEnvironmentRequestResult)}`);
            return await ctx.messageClient.respond("❗Failed to request project environment. Network error.");
        }

        return await ctx.messageClient.addressChannels({
            text: "🚀 Your team's project environment is being provisioned...",
        }, this.teamChannel);
    }

    protected async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
                return await this.requestUnsetParameters(ctx);
            } catch (error) {
                const teams = await gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
                return await menuForTeams(
                    ctx,
                    teams,
                    this,
                    "Please select a team associated with the project you wish to provision the environments for",
                );
            }
        }
        if (_.isEmpty(this.projectName)) {
            const projects = await gluonProjectsWhichBelongToGluonTeam(ctx, this.teamName);
            return await menuForProjects(
                ctx,
                projects,
                this,
                "Please select the projects you wish to provision the environments for",
            );
        }
        return await success();
    }

    private async requestProjectEnvironment(projectId: string, memberId: string) {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${projectId}`,
            {
                projectEnvironment: {
                    requestedBy: memberId,
                },
            });
    }
}
