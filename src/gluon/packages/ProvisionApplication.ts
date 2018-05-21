import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import axios from "axios";
import _ = require("lodash");
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {
    gluonProjectFromProjectName,
    gluonProjectsWhichBelongToGluonTeam,
    menuForProjects,
} from "../project/Projects";
import {createMenu} from "../shared/GenericMenu";
import {subatomicAppOpenshiftTemplates} from "../shared/SubatomicAppOpenshiftTemplates";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
    menuForTeams,
} from "../team/Teams";
import {
    gluonApplicationsLinkedToGluonProject,
    menuForApplications,
} from "./Applications";

@CommandHandler("Create new OpenShift environments for a project", QMConfig.subatomic.commandPrefix + " provision application")
@Tags("subatomic", "openshift", "application")
export class ProvisionApplication implements HandleCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "application name",
        displayable: false,
        required: false,
    })
    public applicationName: string;

    @Parameter({
        description: "project name",
        displayable: false,
        required: false,
    })
    public projectName: string = null;

    @Parameter({
        description: "team name",
        displayable: false,
        required: false,
    })
    public teamName: string = null;

    @Parameter({
        description: "template name",
        displayable: false,
        required: false,
    })
    public templateName: string = null;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info("Creating new OpenShift environments...");

        if (_.isEmpty(this.teamName) || _.isEmpty(this.projectName) || _.isEmpty(this.applicationName) || _.isEmpty(this.templateName)) {
            return this.requestUnsetParameters(ctx);
        }

        return ctx.messageClient.respond("Hello");
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
                                "Please select a team associated with the project you wish to provision the application for",
                            );
                        });
                    },
                );
        }
        if (_.isEmpty(this.projectName)) {
            return gluonProjectsWhichBelongToGluonTeam(ctx, this.teamName)
                .then(projects => {
                    return menuForProjects(
                        ctx,
                        projects,
                        this,
                        "Please select the projects you wish to provision the application for",
                    );
                });
        }
        if (_.isEmpty(this.applicationName)) {
            return gluonApplicationsLinkedToGluonProject(ctx, this.projectName)
                .then(applications => {
                    return menuForApplications(
                        ctx,
                        applications,
                        this,
                        "Please select the application you wish to provision",
                    );
                });
        }
        if (_.isEmpty(this.templateName)) {
            const namespace = `${_.kebabCase(this.teamName).toLowerCase()}-devops`;
            return subatomicAppOpenshiftTemplates(namespace)
                .then(templates => {
                    return createMenu(ctx, templates.map(template => {
                            return {
                                value: template.metadata.name,
                                text: template.metadata.name,
                            };
                        }),
                        this,
                        "Please select the correct template for you application",
                        "Select a template",
                        "templateName");
                });
        }
    }

}
