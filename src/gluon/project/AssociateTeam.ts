import {
    CommandHandler,
    HandleCommand,
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
import {
    gluonTenantFromTenantName, gluonTenantList,
    menuForTenants,
} from "../shared/Tenant";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo, menuForTeams,
} from "../team/Teams";

@CommandHandler("Add additional team/s to a project", QMConfig.subatomic.commandPrefix + " associate team")
export class AssociateTeam implements HandleCommand<HandlerResult> {

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

    @Parameter({
        description: "team name",
        required: false,
        displayable: false,
    })
    public teamName: string;

    @Parameter({
        description: "tenant name",
        required: false,
        displayable: false,
    })
    public tenantName: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName) || _.isEmpty(this.tenantName)) {
            return this.requestUnsetParameters(ctx);
        }
        return gluonTenantFromTenantName(this.tenantName).then(tenant => {
            return this.requestNewProjectForTeamAndTenant(ctx, this.screenName, this.teamName, tenant.tenantId);
        });
    }

    private requestUnsetParameters(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            return gluonTeamForSlackTeamChannel(this.teamChannel)
                .then(
                    team => {
                        this.teamName = team.name;
                        return this.requestUnsetParameters(ctx);
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
