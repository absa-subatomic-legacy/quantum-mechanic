import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult, MappedParameter, MappedParameters, Parameter,
    success,
} from "@atomist/automation-client";
import {menuForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {OCClient} from "../../openshift/OCClient";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
} from "../team/Teams";
import {gluonProjectsWhichBelongToGluonTeam} from "./Projects";

@CommandHandler("Create a new project", QMConfig.subatomic.commandPrefix + " create project")
export class CreateProjectPVC implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "Gluon team id of team associated to project pvc will be created for",
        required: false,
        displayable: false,
    })
    public gluonTeamName;

    @Parameter({
        description: "Gluon project to create pvc's for",
        required: false,
        displayable: false,
    })
    public gluonProject: string;

    @Parameter({
        description: "Gluon project to create pvc's for",
        required: true,
    })
    public pvcName: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        if (this.gluonProject == null) {

            if (this.teamChannel == null) {
                return this.presentMenuToSelectProjectAssociatedTeam(ctx);
            } else {
                return gluonTeamForSlackTeamChannel(this.teamChannel).then(team => {
                    if (team !== null) {
                        return this.presentMenuToSelectProjectToCreatePVCFor(ctx);
                    } else {
                        return this.presentMenuToSelectProjectAssociatedTeam(ctx);
                    }
                });
            }
        }

        this.pvcName = _.kebabCase(this.pvcName);
        let response = "The following PVC's have been created:\n";
        return Promise.all([["dev"],
            ["sit"],
            ["uat"]]
            .map(environment => {
                const fullPVCName = `${this.gluonTeamName}-${this.pvcName}-${environment}`;
                return OCClient.createPVC(fullPVCName, fullPVCName).then(() => {
                    response += `\t${environment}: ${fullPVCName}\n`;
                });
                // TODO: maybe we need error messages for PVC's that fail to create?
            })).then(() => {
            return ctx.messageClient.respond(response);
        });
    }

    private presentMenuToSelectProjectAssociatedTeam(ctx: HandlerContext): Promise<HandlerResult> {
        return gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName).then(teams => {
            const msg: SlackMessage = {
                text: "Please select a team associated to the project you wish to create a PVC for",
                attachments: [{
                    fallback: "A menu",
                    actions: [
                        menuForCommand({
                                text: "Select Team", options:
                                    teams.map(team => {
                                        return {
                                            value: team.name,
                                            text: team.name,
                                        };
                                    }),
                            },
                            this, "gluonTeamName",
                            {pvcName: this.pvcName}),
                    ],
                }],
            };

            return ctx.messageClient.addressUsers(msg, this.screenName)
                .then(success);
        });
    }

    private presentMenuToSelectProjectToCreatePVCFor(ctx: HandlerContext): Promise<HandlerResult> {
        return gluonProjectsWhichBelongToGluonTeam(ctx, this.gluonTeamName).then(teams => {
            const msg: SlackMessage = {
                text: "Please select the project you wish to create a PVC for",
                attachments: [{
                    fallback: "A menu",
                    actions: [
                        menuForCommand({
                                text: "Select Project", options:
                                    teams.map(project => {
                                        return {
                                            value: project.projectId,
                                            text: project.name,
                                        };
                                    }),
                            },
                            this, "gluonProjectId",
                            {
                                gluonTeamName: this.gluonTeamName,
                                pvcName: this.pvcName,
                            }),
                    ],
                }],
            };

            return ctx.messageClient.addressUsers(msg, this.screenName)
                .then(success);
        });
    }
}
