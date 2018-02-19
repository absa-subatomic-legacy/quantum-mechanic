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
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {addBotToSlackChannel} from "@atomist/lifecycle-automation/handlers/command/slack/AddBotToChannel";
import {createChannel} from "@atomist/lifecycle-automation/handlers/command/slack/CreateChannel";
import {SlackMessage, url} from "@atomist/slack-messages";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {CreateTeam} from "./CreateTeam";
import {NewDevOpsEnvironment} from "./DevOpsEnvironment";
import {AddMemberToTeam} from "./JoinTeam";

@CommandHandler("Check whether to create a new team channel or use an existing channel")
@Tags("subatomic", "slack", "channel", "team")
export class NewOrUseTeamSlackChannel implements HandleCommand {

    @Parameter({
        description: "team name",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: false,
    })
    public teamChannel: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        const text: string = `\
Would you like to create a new team channel called *${this.teamChannel}* or \
if you have an existing channel you'd like to use for team wide messages, \
rather use that instead?\
        `;
        const msg: SlackMessage = {
            text,
            attachments: [{
                fallback: `Do you want to create a new team channel (${this.teamChannel}) or link an existing one?`,
                footer: `For more information, please read the ${this.docs()}`,
                actions: [
                    buttonForCommand(
                        {text: `Create channel ${this.teamChannel}`},
                        new NewTeamSlackChannel(),
                        {
                            teamId: ctx.teamId,
                            teamName: this.teamName,
                            teamChannel: this.teamChannel,
                        }),
                    buttonForCommand(
                        {text: "Use an existing channel"},
                        new LinkExistingTeamSlackChannel(),
                        {
                            teamId: ctx.teamId,
                            teamName: this.teamName,
                        }),
                ],
            }],
        };
        return ctx.messageClient.respond(msg)
            .then(success);
    }

    private docs(): string {
        return `${url(`${config.get("subatomic").docs.baseUrl}/teams#slack`,
            "documentation")}`;
    }
}

@CommandHandler("Create team channel", QMConfig.subatomic.commandPrefix + " create team channel")
@Tags("subatomic", "slack", "channel", "team")
export class NewTeamSlackChannel implements HandleCommand {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @Parameter({
        description: "team name",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: false,
        displayable: false,
    })
    public teamChannel: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {

        // TODO this should all move to an event.
        // this should just be a call to Gluon to add the Slack team channel
        // and have an event handler actually create the channel

        this.teamChannel = _.isEmpty(this.teamChannel) ? this.teamName : this.teamChannel;
        return linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.teamChannel, this.docs());
    }

    private docs(): string {
        return `${url(`${config.get("subatomic").docs.baseUrl}/teams`,
            "documentation")}`;
    }
}

@CommandHandler("Link existing team channel", QMConfig.subatomic.commandPrefix + " link team channel")
@Tags("subatomic", "slack", "channel", "team")
export class LinkExistingTeamSlackChannel implements HandleCommand {

    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @Parameter({
        description: "team name",
    })
    public teamName: string;

    @Parameter({
        description: "team channel name",
        required: true,
    })
    public teamChannel: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {
        return linkSlackChannelToGluonTeam(ctx, this.teamName, this.teamId, this.teamChannel, this.docs());
    }

    private docs(): string {
        return `${url(`${config.get("subatomic").docs.baseUrl}/teams`,
            "documentation")}`;
    }
}

function linkSlackChannelToGluonTeam(ctx: HandlerContext,
                                     gluonTeamName: string,
                                     slackTeamId: string,
                                     slackChannelName: string,
                                     documentationLink: string): Promise<HandlerResult> {
    const kebabbedTeamChannel: string = _.kebabCase(slackChannelName);
    return axios.get(`${config.get("subatomic").gluon.baseUrl}/teams?name=${gluonTeamName}`)
        .then(team => {
            if (!_.isEmpty(team.data._embedded)) {
                logger.info(`Updating team channel [${kebabbedTeamChannel}]: ${team.data._embedded.teamResources[0].teamId}`);
                return axios.put(`${config.get("subatomic").gluon.baseUrl}/teams/${team.data._embedded.teamResources[0].teamId}`,
                    {
                        slack: {
                            teamChannel: kebabbedTeamChannel,
                        },
                    })
                    .then(() => {
                        return createChannel(ctx, slackTeamId, kebabbedTeamChannel)
                            .then(channel => {
                                if (channel && channel.createSlackChannel) {
                                    return addBotToSlackChannel(ctx, slackTeamId, channel.createSlackChannel.id);
                                } else {
                                    return Promise.reject(`Error creating or finding slack channel: ${JSON.stringify(channel)}`);
                                }
                            }, error => {
                                logger.error(`Error creating Slack channel: ${JSON.stringify(error)}`);

                                if (error.networkError.response.status === 400) {
                                    logger.warn(`Most likely trying to link a private Slack channel: ${error.message}. This is currently NOT SUPPORTED`);
                                } else {
                                    return Promise.reject(`Slack channel could not be created: ${error.message}`);
                                }
                            }).then(() => {

                                // TODO add all existing team members to the team
                                // Slack channel just created

                                const msg: SlackMessage = {
                                    text: `Welcome to the ${slackChannelName} team channel!`,
                                    attachments: [{
                                        fallback: `Welcome to the ${slackChannelName} team channel!`,
                                        footer: `For more information, please read the ${documentationLink}`,
                                        text: `
If you haven't already, you might want to:

• create an OpenShift DevOps environment
• add new team members
                                                          `,
                                        mrkdwn_in: ["text"],
                                        actions: [
                                            buttonForCommand(
                                                {text: "Create DevOps environment"},
                                                new NewDevOpsEnvironment()),
                                            buttonForCommand(
                                                {text: "Add team members"},
                                                new AddMemberToTeam(),
                                                {teamChannel: kebabbedTeamChannel}),
                                        ],
                                    }],
                                };

                                return ctx.messageClient.addressChannels(msg, kebabbedTeamChannel);

                                // TODO respond back after creating team channel and now offer
                                // opportunity to create OpenShift Dev environment?
                            })
                            .catch(err => failure(err));
                    });
            } else {
                const msg: SlackMessage = {
                    text: `There was an error creating your *${gluonTeamName}* team channel`,
                    attachments: [{
                        text: `
Unfortunately this team does not seem to exist on Subatomic.
To create a team channel you must first create a team. Click the button below to do that now.
                                                  `,
                        fallback: "Team does not exist on Subatomic",
                        footer: `For more information, please read the ${documentationLink}`,
                        color: "#D94649",
                        mrkdwn_in: ["text"],
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Create team",
                                },
                                new CreateTeam()),
                        ],
                    }],
                };

                return ctx.messageClient.respond(msg);
            }
        })
        .catch(e => failure(e));
}
