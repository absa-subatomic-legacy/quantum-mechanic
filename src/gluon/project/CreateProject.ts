import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../shared/RecursiveParameterRequestCommand";
import {
    gluonTenantFromTenantName,
    gluonTenantList,
    menuForTenants,
} from "../shared/Tenant";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
    menuForTeams,
} from "../team/Teams";

@CommandHandler("Create a new project", QMConfig.subatomic.commandPrefix + " create project")
export class CreateProject extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "project name",
    })
    public name: string;

    @Parameter({
        description: "project description",
    })
    public description: string;

    @RecursiveParameter({
        description: "team name",
    })
    public teamName: string;

    @RecursiveParameter({
        description: "tenant name",
    })
    public tenantName: string;

    protected async runCommand(ctx: HandlerContext) {
        const tenant = await gluonTenantFromTenantName(this.tenantName);
        logger.info("-----");
        return await this.requestNewProjectForTeamAndTenant(ctx, this.screenName, this.teamName, tenant.tenantId);
    }

    protected async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
            } catch (error) {
                const teams = await gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
                return await menuForTeams(
                    ctx,
                    teams,
                    this,
                    "Please select a team you would like to associate this project with",
                );
            }
        }
        if (_.isEmpty(this.tenantName)) {
            const tenants = await gluonTenantList();
            return await menuForTenants(ctx,
                tenants,
                this,
                "Please select a tenant you would like to associate this project with. Choose Default if you have no tenant specified for this project.",
            );
        }
    }

    private async requestNewProjectForTeamAndTenant(ctx: HandlerContext, screenName: string,
                                                    teamName: string, tenantId: string): Promise<any> {
        let member;
        try {
            member = await gluonMemberFromScreenName(ctx, screenName);
        } catch (error) {
            return await logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
        }
        const teamQueryResult = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);
        if (teamQueryResult.status !== 200) {
            logger.error(`❗Failed to find team ${teamName}. Error: ${JSON.stringify(teamQueryResult)}`);
            return ctx.messageClient.respond(`Team ${teamName} does not appear to be a valid Sub Atomic team.`);
        }

        const team = teamQueryResult.data._embedded.teamResources[0];
        const projectCreationResult = await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/projects`,
            {
                name: this.name,
                description: this.description,
                createdBy: member.memberId,
                owningTenant: tenantId,
                teams: [{
                    teamId: team.teamId,
                }],
            });
        if (projectCreationResult.status === 409) {
            logger.error(`Failed to create project since the project name is already in use.`);
            return await ctx.messageClient.respond(`❗Failed to create project since the project name is already in use. Please retry using a different project name.`);
        } else if (projectCreationResult.status !== 201) {
            logger.error(`Failed to create project with error: ${JSON.stringify(projectCreationResult.data)}`);
            return await ctx.messageClient.respond(`❗Failed to create project.`);
        }

        return await ctx.messageClient.respond("🚀Project successfully created.");
    }
}
