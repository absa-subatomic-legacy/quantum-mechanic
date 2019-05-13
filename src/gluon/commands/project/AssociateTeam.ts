import {
    HandlerContext,
    HandlerResult,
    logger,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import * as _ from "lodash";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {menuAttachmentForProjects} from "../../util/project/Project";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {RecursiveSetterResult} from "../../util/recursiveparam/RecursiveSetterResult";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {menuAttachmentForTeams} from "../../util/team/Teams";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Add additional team/s to a project", atomistIntent(CommandIntent.AssociateTeam))
@Tags("subatomic", "team", "project")
export class AssociateTeam extends RecursiveParameterRequestCommand {

    @RecursiveParameter({
        callOrder: 1,
        selectionMessage: `Please select a team you would like to associate to the project`,
        setter: setGluonTeamFromUnassociatedTeams,
    })
    public teamName: string;

    @RecursiveParameter({
        callOrder: 0,
        selectionMessage: `Please select a project you would like to associate this team to.`,
        setter: setGluonProjectNameFromList,
    })
    public projectName: string;

    public constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            const result = await this.linkProjectForTeam(ctx, this.teamName);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await this.handleError(ctx, error);
        }
    }

    private async linkProjectForTeam(ctx: HandlerContext, teamName: string): Promise<HandlerResult> {
        const team = await this.gluonService.teams.gluonTeamByName(teamName);
        const gluonProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);
        let updateGluonWithProjectDetails;
        try {
            updateGluonWithProjectDetails = await this.updateGluonProject(gluonProject.projectId, gluonProject.createdBy, team.teamId, team.name);
        } catch (error) {
            throw new QMError(`Team *${team.name}* was already associated with project *${gluonProject.name}*`);
        }

        if (isSuccessCode(updateGluonWithProjectDetails.status)) {
            return await ctx.messageClient.respond(`Team *${team.name}* has been successfully associated with *${gluonProject.name}*`);
        } else {
            logger.error(`Failed to link project. Error ${updateGluonWithProjectDetails.data}`);
            throw new QMError(`Failed to link project.`);
        }

    }

    private async updateGluonProject(projectId: string, createdBy: string, teamId: string, name: string) {

        return await this.gluonService.projects.associateTeamToProject(projectId,
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

async function setGluonTeamFromUnassociatedTeams(ctx: HandlerContext, commandHandler: AssociateTeam): Promise<RecursiveSetterResult> {
    const teams = await commandHandler.gluonService.teams.gluonTeamsWhoSlackScreenNameBelongsTo(commandHandler.screenName);
    const availTeams = await availableTeamsToAssociate(commandHandler.gluonService, teams, commandHandler.projectName);

    if (_.isEmpty(availTeams)) {
        return {
            setterSuccess: false,
            messagePrompt: {text: "Unfortunately there are no available teams to associate to."},
        };
    }

    return {
        setterSuccess: false,
        messagePrompt: menuAttachmentForTeams(
            ctx,
            availTeams,
            commandHandler,
            `Please select a team you would like to associate to *${commandHandler.projectName}*.`,
        ),
    };
}

async function availableTeamsToAssociate(gluonService: GluonService, teams: any[], projectName: string): Promise<any[]> {
    const allTeams = [];
    const associatedTeams = [];
    const unlinked = [];

    for (const team of teams) {
        allTeams.push(team.name);
    }

    const projectTeams = await gluonService.projects.gluonProjectFromProjectName(projectName);

    for (const team of projectTeams.teams) {
        associatedTeams.push(team.name);
    }
    for (const i of allTeams) {
        if (!associatedTeams.includes(i)) {
            unlinked.push(i);
        }
    }

    return unlinked.map(team => {
        return {
            name: team,
        };
    });
}

export async function setGluonProjectNameFromList(
    ctx: HandlerContext,
    commandHandler: AssociateTeam,
    selectionMessage: string = "Please select a project"): Promise<RecursiveSetterResult> {

    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonProjectName commandHandler requires gluonService parameter to be defined`);
    }

    const projects = await commandHandler.gluonService.projects.gluonProjectList();
    return {
        setterSuccess: false,
        messagePrompt: menuAttachmentForProjects(
            ctx,
            projects,
            commandHandler,
            selectionMessage,
        ),
    };
}
