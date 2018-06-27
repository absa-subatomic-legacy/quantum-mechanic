import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {handleQMError, QMError, ResponderMessageClient} from "../shared/Error";
import {createMenu} from "../shared/GenericMenu";
import {isSuccessCode} from "../shared/Http";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../shared/RecursiveParameterRequestCommand";
import {gluonTeamsWhoSlackScreenNameBelongsTo} from "../team/Teams";
import {
    gluonProjectFromProjectName,
    gluonProjects,
    menuForProjects,
} from "./Projects";

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

    public constructor(projectName: string) {
        super();
        this.projectName = projectName;
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            return await this.linkProjectForTeam(ctx, this.teamName);
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
            return await this.menuForTeams(
                ctx,
                teams,
                this.projectName,
                this,
                `Please select a team you would like to associate to *${this.projectName}*.`,
            );
        }
    }

    private async linkProjectForTeam(ctx: HandlerContext, teamName: string): Promise<HandlerResult> {
        const team = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);
        const gluonProject = await gluonProjectFromProjectName(ctx, this.projectName);
        let updateGluonWithProjectDetails;
        try {
            updateGluonWithProjectDetails = await this.updateGluonProject(gluonProject.projectId, gluonProject.createdBy, team.data._embedded.teamResources[0].teamId, team.data._embedded.teamResources[0].name);
        } catch (error) {
            throw new QMError(`Team *${team.data._embedded.teamResources[0].name}* was already associated with project ${gluonProject.projectId}`);
        }

        if (isSuccessCode(updateGluonWithProjectDetails.status)) {
            return await ctx.messageClient.respond(`Team *${team.data._embedded.teamResources[0].name}* has been successfully associated with ${gluonProject.projectId}`);
        } else {
            logger.error(`Failed to link project. Error ${updateGluonWithProjectDetails.data}`);
            throw new QMError(`Failed to link project.`);
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

    private async menuForTeams(ctx: HandlerContext, teams: any[],
                               projectName: string,
                               command: HandleCommand, message: string = "Please select a team",
                               projectNameVariable: string = "teamName"): Promise<any> {
        const allTeams = [];
        const associatedTeams = [];
        const unlinked = [];

        for (const team of teams) {
            allTeams.push(team.name);
        }

        const projectDetails = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/projects?name=${projectName}`);
        if (!isSuccessCode(projectDetails.status)) {
            throw new QMError("Failed to get project details for the project specified.");
        }
        const projectTeams = projectDetails.data._embedded.projectResources[0];

        for (const team of projectTeams.teams) {
            associatedTeams.push(team.name);
        }
        for (const i of allTeams) {
            if (!associatedTeams.includes(i)) {
                unlinked.push(i);
            }
        }

        return createMenu(ctx,
            unlinked.map(team => {
                return {
                    value: team,
                    text: team,
                };
            }),
            command,
            message,
            "Select Team",
            projectNameVariable,
        );
    }
}
