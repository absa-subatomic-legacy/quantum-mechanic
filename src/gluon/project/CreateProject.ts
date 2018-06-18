import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    MappedParameter,
    MappedParameters,
    Parameter,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {RecursiveParameter, RecursiveParameterRequestCommand} from "../shared/RecursiveParameterRequestCommand";
import {
    gluonTenantFromTenantName, gluonTenantList,
    menuForTenants,
} from "../shared/Tenant";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo, menuForTeams,
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
        displayable: false,
        required: false,
    })
    public teamName: string;

    @RecursiveParameter({
        description: "tenant name",
    })
    public tenantName: string;

    protected runCommand(ctx: HandlerContext) {
        return gluonTenantFromTenantName(this.tenantName).then(tenant => {
            return this.requestNewProjectForTeamAndTenant(ctx, this.screenName, this.teamName, tenant.tenantId);
        });
    }

    protected setNextParameter(ctx: HandlerContext): Promise<HandlerResult> | void {
        if (_.isEmpty(this.teamName)) {
            return gluonTeamForSlackTeamChannel(this.teamChannel)
                .then(
                    team => {
                        this.teamName = team.name;
                        return this.setNextParameter(ctx) || null;
                    },
                    () => {
                        return gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName).then(teams => {
                            return menuForTeams(
                                ctx,
                                teams,
                                this,
                                "Please select a team you would like to associate this project with",
                            );
                        }).catch(error => {
                            logErrorAndReturnSuccess(gluonTeamsWhoSlackScreenNameBelongsTo.name, error);
                        });
                    },
                );
        }
        if (_.isEmpty(this.tenantName)) {
            return gluonTenantList().then(tenants => {
                return menuForTenants(ctx,
                    tenants,
                    this,
                    "Please select a tenant you would like to associate this project with. Choose Default if you have no tenant specified for this project.",
                );
            });
        }
    }

    private requestNewProjectForTeamAndTenant(ctx: HandlerContext, screenName: string,
                                              teamName: string, tenantId: string): Promise<any> {
        return gluonMemberFromScreenName(ctx, screenName)
            .then(member => {
                axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`)
                    .then(team => {
                        if (!_.isEmpty(team.data._embedded)) {
                            return axios.post(`${QMConfig.subatomic.gluon.baseUrl}/projects`,
                                {
                                    name: this.name,
                                    description: this.description,
                                    createdBy: member.memberId,
                                    owningTenant: tenantId,
                                    teams: [{
                                        teamId: team.data._embedded.teamResources[0].teamId,
                                    }],
                                }).catch(error => {
                                if (error.response.status === 409) {
                                    return ctx.messageClient.respond(`❗Failed to create project since the project name is already in use. Please retry using a different project name.`);
                                } else {
                                    return ctx.messageClient.respond(`❗Failed to create project with error: ${JSON.stringify(error.response.data)}`);
                                }
                            });
                        }
                    });
            }).catch(error => {
                logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
            });
    }
}
