import {
    HandleCommand,
    HandlerContext,
    logger,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import axios from "axios";
import {QMConfig} from "../../../config/QMConfig";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {JoinTeam} from "../../commands/team/JoinTeam";
import {QMError} from "../shared/Error";
import {createMenu} from "../shared/GenericMenu";
import {isSuccessCode} from "../shared/Http";

export class TeamService {
    public async gluonTeamsWhoSlackScreenNameBelongsTo(screenName: string, requestActionOnFailure: boolean = true): Promise<any[]> {
        logger.debug(`Trying to get gluon teams associated to a screenName. screenName: ${screenName} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackScreenName=${screenName}`);

        if (!isSuccessCode(result.status)) {
            const errorMessage = `Failed to find teams associated to member. Member ${screenName} is either not onboarded, or is not a member of any team..`;
            if (requestActionOnFailure) {
                const slackMessage: SlackMessage = {
                    text: "Unfortunately, you are not a member of any team. To associate this project you need to be a member of at least one team.",
                    attachments: [{
                        text: "You can either create a new team or apply to join an existing team",
                        fallback: "You can either create a new team or apply to join an existing team",
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Apply to join a team",
                                    style: "primary",
                                },
                                new JoinTeam()),
                            buttonForCommand(
                                {text: "Create a new team"},
                                new CreateTeam()),
                        ],
                    }],
                };

                throw new QMError(errorMessage, slackMessage);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.teamResources;
    }

    public async gluonTeamForSlackTeamChannel(teamChannel: string): Promise<any> {
        logger.debug(`Trying to get gluon team associated to a teamChannel. teamChannel: ${teamChannel} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackTeamChannel=${teamChannel}`);

        if (!isSuccessCode(result.status)) {
            throw new QMError(`No team associated with Slack team channel: ${teamChannel}`);
        }

        return result.data._embedded.teamResources[0];

    }

    public async createGluonTeam(teamName: string, teamDescription: string, createdBy: string): Promise<any> {
        return await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/teams`, {
            name: teamName,
            description: teamDescription,
            createdBy,
        });
    }

    public async addSlackDetailsToTeam(teamId: string, slackDetails: any): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`, slackDetails);
    }

    public async addMemberToTeam(teamId: string, memberDetails: any): Promise<any> {
        return await axios.put(teamId,
            memberDetails);
    }

    public async createMembershipRequest(teamId: string, membershipRequestDetails: any): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            membershipRequestDetails);
    }

    public async requestDevOpsEnvironment(teamId: string, memberId: string): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            {
                devOpsEnvironment: {
                    requestedBy: memberId,
                },
            });
    }
}

export function menuForTeams(ctx: HandlerContext, teams: any[],
                             command: HandleCommand, message: string = "Please select a team",
                             projectNameVariable: string = "teamName"): Promise<any> {
    return createMenu(ctx,
        teams.map(team => {
            return {
                value: team.name,
                text: team.name,
            };
        }),
        command,
        message,
        "Select Team",
        projectNameVariable,
    );
}
