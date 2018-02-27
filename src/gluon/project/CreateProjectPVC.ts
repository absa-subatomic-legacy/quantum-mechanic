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

@CommandHandler("Create a new project", QMConfig.subatomic.commandPrefix + " create pvc")
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
        description: "Enter the name of the pvc you wish to create",
        required: true,
    })
    public pvcName: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        if (this.gluonProject == null) {
            if (this.gluonTeamName != null) {
                return this.presentMenuToSelectProjectToCreatePVCFor(ctx, this.gluonTeamName);
            } else {
                return gluonTeamForSlackTeamChannel(this.teamChannel).then(
                    team => {
                        return this.presentMenuToSelectProjectToCreatePVCFor(ctx, team.name);
                    },
                    () => {
                        return this.presentMenuToSelectProjectAssociatedTeam(ctx);
                    },
                );
            }
        }

        this.pvcName = _.kebabCase(this.pvcName);
        let response = "The following PVC's have been created:\n*Environment*\tPVC Name\n";
        const kebabbedProjectName = _.kebabCase(this.gluonProject);
        return OCClient.login(QMConfig.subatomic.openshift.masterUrl, QMConfig.subatomic.openshift.auth.token)
            .then(() => {
                let promiseChain: Promise<any> = Promise.resolve();
                for (const env of ["dev", "sit", "uat"]) {
                    const project = `${kebabbedProjectName}-${env}`;
                    const fullPVCName = `${kebabbedProjectName}-${env}-${this.pvcName}`;
                    promiseChain = promiseChain
                        .then(() => {
                            return OCClient.selectProject(project);
                        })
                        .then(() => {
                            return OCClient.createPVC(fullPVCName);
                        })
                        .then(() => {
                            response += `*${project}:*\t${fullPVCName}\n`;
                        });
                }
                // TODO: maybe we need error messages for PVC's that fail to create?
                return promiseChain.then(() => {
                    return ctx.messageClient.respond(response);
                });
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
                            {
                                pvcName: this.pvcName,
                            }),
                    ],
                }],
            };

            return ctx.messageClient.respond(msg)
                .then(success);
        });
    }

    private presentMenuToSelectProjectToCreatePVCFor(ctx: HandlerContext, teamName: string): Promise<HandlerResult> {
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
                                            value: project.name,
                                            text: project.name,
                                        };
                                    }),
                            },
                            this, "gluonProject",
                            {
                                gluonTeamName: teamName,
                                pvcName: this.pvcName,
                            }),
                    ],
                }],
            };

            return ctx.messageClient.respond(msg)
                .then(success);
        });
    }
}
