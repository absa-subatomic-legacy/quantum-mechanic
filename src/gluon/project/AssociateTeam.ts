import {
    CommandHandler, failure,
    HandlerContext,
    HandlerResult, logger,
    MappedParameter,
    MappedParameters,
    Parameter, success,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {handleQMError, QMError, ResponderMessageClient} from "../shared/Error";
import {RecursiveParameter, RecursiveParameterRequestCommand} from "../shared/RecursiveParameterRequestCommand";
import {gluonTeamsWhoSlackScreenNameBelongsTo, menuForTeams} from "../team/Teams";
import {gluonProjectFromProjectName, gluonProjects, menuForProjects} from "./Projects";

@CommandHandler("Add additional team/s to a project", QMConfig.subatomic.commandPrefix + " associate team")
export class AssociateTeam extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @RecursiveParameter({
        description: "team name",
        required: false,
        displayable: false,
    })
    public teamName: string;

    @RecursiveParameter({
        description: "project name",
        required: false,
        displayable: false,
    })
    public projectName: string;

    @Parameter({
        description: "project description",
        required: false,
        displayable: false,
    })
    public projectDescription: string;

    public constructor(projectName: string, projectDescription: string) {
        super();
        this.projectName = projectName;
        this.projectDescription = projectDescription;
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            await this.linkProjectForTeam(ctx, this.screenName, this.teamName);
            return await success();
        } catch (error) {
            return await this.handleError(ctx, error);
        }
    }

    protected async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.projectName)) {
            const projects = await gluonProjects(ctx);
            return await menuForProjects(
                ctx,
                projects,
                this,
                `Please select a project you would like to associate this team to.`,
            );
        }
        if (_.isEmpty(this.teamName)) {
            const teams = await gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
            return await menuForTeams(
                ctx,
                teams,
                this,
                `Please select a team you would like to associate to *${this.projectName}*.`,
            );
        }

        return await success();
    }

    private async linkProjectForTeam(ctx: HandlerContext, screenName: string,
                                     teamName: string): Promise<any> {
        const member = await gluonMemberFromScreenName(ctx, screenName);
        const team = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);
        if (!_.isEmpty(team.data._embedded)) {
            let gluonProject;
            try {
                gluonProject = await gluonProjectFromProjectName(ctx, this.projectName);
            } catch (error) {
                return failure(error);
            }
            let updateGluonWithProjectDetails;
            try {
                updateGluonWithProjectDetails = await this.updateGluonProject(gluonProject.projectId, gluonProject.createdBy, team.data._embedded.teamResources[0].teamId, team.data._embedded.teamResources[0].name);
            } catch (error) {
                return await this.handleError(ctx, error);
            }
            logger.info(`!!${JSON.stringify(updateGluonWithProjectDetails.status)}`);
            if (updateGluonWithProjectDetails.status === 201) {
                if (this.teamChannel !== team.data._embedded.teamResources[0].name) {
                    return await ctx.messageClient.respond(`Team *${team.data._embedded.teamResources[0].name}* has been successfully associated with ${gluonProject.projectId}`);
                }
            } else {
                return await ctx.messageClient.respond(`❗Failed to link project.`);
            }
        }
    }

    private async updateGluonProject(projectId: string, createdBy: string, teamId: string, name: string) {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${projectId}`,
            {
                productId: `${projectId}`,
                createdBy: `${createdBy}`,
                teams: [{
                    teamId: `${teamId}`,
                    name: `${name}`,
                }],
            });
    }

    private async handleError(ctx: HandlerContext, error) {
        const messageClient = new ResponderMessageClient(ctx);
        return await handleQMError(messageClient, error);
    }
}
