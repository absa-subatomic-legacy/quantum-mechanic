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
import {gluonTeamsWhoSlackScreenNameBelongsTo, menuForTeams} from "../team/Teams";
import {gluonProjectFromProjectName, gluonProjects, menuForProjects} from "./Projects";

@CommandHandler("Add additional team/s to a project", QMConfig.subatomic.commandPrefix + " associate team")
export class AssociateTeam implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "team name",
        required: false,
        displayable: false,
    })
    public teamName: string;

    @Parameter({
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

    @Parameter({
        description: "tenant name",
        required: false,
        displayable: false,
    })
    public tenantName: string;

    public constructor(projectName: string, projectDescription: string) {
        this.projectName = projectName;
        this.projectDescription = projectDescription;
    }

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.projectName) || _.isEmpty(this.teamName) || _.isEmpty(this.tenantName)) {
            return this.requestUnsetParameters(ctx);
        }
        return gluonTenantFromTenantName(this.tenantName).then(tenant => {
            return this.linkProjectForTeam(ctx, this.screenName, this.teamName);
        });
    }

    private requestUnsetParameters(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.projectName)) {
            return gluonProjects(ctx).then(projects => {
                return menuForProjects(
                    ctx,
                    projects,
                    this,
                    `Please select a project you would like to associate this team to.`,
                );
            }).catch(error => {
                logErrorAndReturnSuccess(gluonTeamsWhoSlackScreenNameBelongsTo.name, error);
            });
        }
        if (_.isEmpty(this.teamName)) {
            return gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName).then(teams => {
                return menuForTeams(
                    ctx,
                    teams,
                    this,
                    `Please select a team you would like to associate to *${this.projectName}*.`,
                );
            }).catch(error => {
                logErrorAndReturnSuccess(gluonTeamsWhoSlackScreenNameBelongsTo.name, error);
            });
        }
        if (_.isEmpty(this.tenantName)) {
            return gluonTenantList().then(tenants => {
                return menuForTenants(
                    ctx,
                    tenants,
                    this,
                    `Please select a tenant you would like to associate to *${this.projectName}* with. Choose Default if you have no tenant specified for this project.`,
                );
            });
        }
    }

    private linkProjectForTeam(ctx: HandlerContext, screenName: string,
                               teamName: string): Promise<any> {
        return gluonMemberFromScreenName(ctx, screenName)
            .then(member => {
                axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`)
                    .then(team => {
                        if (!_.isEmpty(team.data._embedded)) {
                            return gluonProjectFromProjectName(ctx, this.projectName)
                                .then(gluonProject => {
                                    return axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${gluonProject.projectId}`,
                                        {
                                            productId: gluonProject.projectId,
                                            createdBy: gluonProject.createdBy,
                                            teams: [{
                                                teamId: team.data._embedded.teamResources[0].teamId,
                                                name: team.data._embedded.teamResources[0].name,
                                            }],
                                        }).then( () => {
                                        return ctx.messageClient.respond(`Linked project with ${team.data._embedded.teamResources[0].teamId}`);
                                    })
                                        .catch(error => {
                                            return ctx.messageClient.respond(`❗Failed to link project with error: ${JSON.stringify(error.response.data)}.`);
                                        });
                                }).catch(error => {
                                    return ctx.messageClient.respond(`❗Failed to link project with error: ${JSON.stringify(error.response.data)}`);
                                });
                        }
                    });
            }).catch(error => {
                logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
            });
    }
}
