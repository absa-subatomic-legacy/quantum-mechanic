import {
    CommandHandler,
    failure,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import {
    buttonForCommand,
    menuForCommand,
} from "@atomist/automation-client/spi/message/MessageClient";
import {inviteUserToSlackChannel} from "@atomist/lifecycle-automation/handlers/command/slack/AssociateRepo";
import {SlackMessage, url} from "@atomist/slack-messages";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import * as graphql from "../../typings/types";
import {ListTeamProjects} from "../project/ProjectDetails";
import {CreateTeam} from "./CreateTeam";

@CommandHandler("Apply to join an existing team", QMConfig.subatomic.commandPrefix + " apply to team")
@Tags("subatomic", "team")
export class JoinTeam implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUser)
    public slackName: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams`)
            .then(teams => {
                logger.info(`Got teams data: ${JSON.stringify(teams.data)}`);

                // remove teams that he is already a member of - TODO in future

                // present the list of teams as a select
                const msg: SlackMessage = {
                    text: "Please select the team you would like to join",
                    attachments: [{
                        fallback: "Some buttons",
                        actions: [
                            menuForCommand({
                                    text: "Select Team", options:
                                        teams.data._embedded.teamResources.map(team => {
                                            return {
                                                value: team.teamId,
                                                text: team.name,
                                            };
                                        }),
                                },
                                "CreateMembershipRequestToTeam", "teamId",
                                {slackName: this.slackName}),
                        ],
                    }],
                };

                return ctx.messageClient.addressUsers(msg, this.slackName)
                    .then(success);
            }).catch( () => {
                const msg: SlackMessage = {
                    text: `Unfortunately no teams have been created.`,
                    attachments: [{
                        fallback: "Welcome to the Subatomic environment",
                        footer: `For more information, please read ${this.docs()}`,
                        thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                        actions: [
                            buttonForCommand(
                                {text: "Create a new team"},
                                new CreateTeam()),
                        ],
                    }],
                };
                return ctx.messageClient.addressUsers(msg, this.slackName);
            });
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#create-team`,
            "documentation")}`;
    }
}

@CommandHandler("Add a member to a team", QMConfig.subatomic.commandPrefix + " add team member")
@Tags("subatomic", "team", "member")
export class AddMemberToTeam implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @MappedParameter(MappedParameters.SlackChannel)
    public channelId: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "slack name of the member to add",
    })
    public slackName: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Adding member [${this.slackName}] to team: ${this.teamChannel}`);

        let screenName = this.slackName;
        if (this.slackName.startsWith("<@")) {
            screenName = _.replace(this.slackName, /(<@)|>/g, "");
        }

        return loadScreenNameByUserId(ctx, screenName)
            .then(chatId => {
                if (!_.isEmpty(chatId)) {
                    logger.info(`Got ChatId: ${chatId}`);
                    return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${chatId}`)
                        .then(newMember => {
                            logger.info(`Member: ${JSON.stringify(newMember.data)}`);
                            if (!_.isEmpty(newMember.data._embedded)) {
                                const newTeamMember = newMember.data._embedded.teamMemberResources[0];
                                logger.info(JSON.stringify(newTeamMember));
                                if (!_.isEmpty(_.find(newTeamMember.teams,
                                        (team: any) => team.slack.teamChannel === this.teamChannel))) {
                                    return ctx.messageClient.respond(`${newTeamMember.slack.screenName} is already a member of this team.`);
                                }

                                logger.info(`Getting teams that ${this.screenName} (you) are a part of...`);

                                return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${this.screenName}`)
                                    .then(member => {
                                        if (!_.isEmpty(member.data._embedded)) {
                                            const you = member.data._embedded.teamMemberResources[0];
                                            logger.info(`Got member's teams you belong to: ${JSON.stringify(you)}`);

                                            const teamSlackChannel = _.find(you.teams,
                                                (team: any) => team.slack.teamChannel === this.teamChannel);
                                            logger.info(`Found team Slack channel: ${JSON.stringify(teamSlackChannel)}`);
                                            if (!_.isEmpty(teamSlackChannel)) {
                                                const newMemberId = newTeamMember.memberId;
                                                logger.info(`Adding member [${newMemberId}] to team with ${JSON.stringify(teamSlackChannel._links.self.href)}`);
                                                return axios.put(teamSlackChannel._links.self.href,
                                                    {
                                                        members: [{
                                                            memberId: newMemberId,
                                                        }],
                                                        createdBy: you.memberId,
                                                    })
                                                    .then(() => {
                                                        logger.info(`Added team member! Inviting to channel [${this.channelId}] -> member [${screenName}]`);
                                                        return inviteUserToSlackChannel(ctx,
                                                            this.teamId,
                                                            this.channelId,
                                                            screenName)
                                                            .then(() => {
                                                                const msg: SlackMessage = {
                                                                    text: `Welcome to the team *${newTeamMember.firstName}*!`,
                                                                    attachments: [{
                                                                        text: `
Welcome *${newTeamMember.firstName}*, you have been added to the *${teamSlackChannel.name}* team by <@${you.slack.userId}>.
Click the button below to become familiar with the projects this team is involved in.
                                                                              `,
                                                                        fallback: `Welcome to the team ${newTeamMember.firstName}`,
                                                                        footer: `For more information, please read the ${this.docs("list-projects")}`,
                                                                        mrkdwn_in: ["text"],
                                                                        thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                                                                        actions: [
                                                                            buttonForCommand(
                                                                                {text: "Show team projects"},
                                                                                new ListTeamProjects()),
                                                                        ],
                                                                    }],
                                                                };

                                                                return ctx.messageClient.addressChannels(msg, this.teamChannel);
                                                            }, () => {
                                                                return ctx.messageClient.addressChannels(`User ${this.slackName} successfully added to your gluon team. Private channels do not currently support automatic user invitation.` +
                                                                    " Please invite the user to this slack channel manually.", this.teamChannel);
                                                            });
                                                    })
                                                    .catch(err => failure(err));
                                            } else {
                                                return ctx.messageClient.respond({
                                                    text: "This is not a team channel or not a team channel you belong to",
                                                    attachments: [{
                                                        text: `
This channel (*${this.teamChannel}*) is not a team channel for a team that you belong to.
You can only invite a new member to your team from a team channel that you belong to. Please retry this in one of those team channels.
                                                              `,
                                                        color: "#D94649",
                                                        mrkdwn_in: ["text"],
                                                    }],
                                                });
                                            }
                                        } else {
                                            // TODO deal with the fact that the requester is not part of any teams
                                        }
                                    })
                                    .catch(err => failure(err));

                                // call Gluon (in future use local cache) to create the link
                            } else {
                                const msg: SlackMessage = {
                                    text: `There was an issue adding ${this.slackName} to your team`,
                                    attachments: [{
                                        text: `
It appears ${this.slackName} is not onboarded onto Subatomic.

They must first be onboarded onto Subatomic _before_ they can be added to a team. Please ask them to onboard by asking them to type \`@atomist ${QMConfig.subatomic.commandPrefix} onboard me\`
                            `,
                                        fallback: `${this.slackName} is not onboarded onto Subatomic`,
                                        footer: `For more information, please read the ${this.docs("onboard-me")}`,
                                        color: "#D94649",
                                        mrkdwn_in: ["text"],
                                        thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                                    }],
                                };

                                return ctx.messageClient.respond(msg);
                            }
                        });
                } else {
                    return ctx.messageClient.respond({
                        text: `The Slack name you typed (${this.slackName}) does not appear to be a valid Slack user`,
                        attachments: [{
                            text: `
Adding a team member from Slack requires typing their \`@mention\` name or using their actual Slack screen name.
                                  `,
                            fallback: `${this.slackName} is not onboarded onto Subatomic`,
                            footer: `For more information, please read the ${this.docs("onboard-me")}`,
                            color: "#D94649",
                            mrkdwn_in: ["text"],
                            thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                        }, {
                            text: `Tip: You can get your Slack screen name by typing \`@atomist ${QMConfig.subatomic.commandPrefix} whoami\``,
                            color: "#00a5ff",
                            mrkdwn_in: ["text"],
                        }],
                    });
                }
            })
            .then(success)
            .catch(err => failure(err));

        // respond to member that he has been added to the team and
        // that he has the X role assigned to him.
    }

    private docs(extension): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#${extension}`,
            "documentation")}`;
    }
}

@CommandHandler("Request membership to a team")
@Tags("subatomic", "team", "member")
export class CreateMembershipRequestToTeam implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @Parameter({
        description: "Gluon team id to create a membership request to.",
        displayable: false,

    })
    public teamId: string;

    @Parameter({
        description: "Slack name of the member to add.",
    })
    public slackName: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Request to join team: ${this.teamId}`);

        let screenName = this.slackName;
        if (this.slackName.startsWith("<@")) {
            screenName = _.replace(this.slackName, /(<@)|>/g, "");
        }

        return loadScreenNameByUserId(ctx, screenName)
            .then(chatId => {
                if (!_.isEmpty(chatId)) {
                    logger.info(`Got ChatId: ${chatId}`);
                    return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${chatId}`)
                        .then(newMember => {
                            logger.info(`Member: ${JSON.stringify(newMember.data)}`);
                            return axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${this.teamId}`,
                                {
                                    membershipRequests: [
                                        {
                                            requestedBy: {
                                                memberId: newMember.data._embedded.teamMemberResources[0].memberId,
                                            },
                                        }],
                                }).then(() => {
                                    return success();
                            }).catch( () => {
                                return ctx.messageClient.addressUsers(`You are already a member of this team.`, this.slackName);
                            });

                        });
                }
            }).catch(error => failure(error));
    }
}

export function loadScreenNameByUserId(ctx: HandlerContext, userId: string): Promise<graphql.ChatId.ChatId> {
    return ctx.graphClient.executeQueryFromFile<graphql.ChatId.Query, graphql.ChatId.Variables>(
        "graphql/query/chatIdByUserId",
        {userId})
        .then(result => {
            if (result) {
                if (result.ChatId && result.ChatId.length > 0) {
                    return result.ChatId[0].screenName;
                }
            }
            return null;
        })
        .catch(err => {
            logger.error("Error occurred running GraphQL query: %s", err);
            return null;
        });
}
