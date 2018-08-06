import {logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {JoinTeam} from "../../commands/team/JoinTeam";
import {QMError} from "../../util/shared/Error";
import {isSuccessCode} from "../../util/shared/Http";
import {AwaitAxios} from "../../util/shared/AwaitAxios";

export class TeamService {

    private axiosInstance = new AwaitAxios();

    public async gluonTeamsWhoSlackScreenNameBelongsTo(screenName: string, requestActionOnFailure: boolean = true): Promise<any[]> {
        logger.debug(`Trying to get gluon teams associated to a screenName. screenName: ${screenName} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackScreenName=${screenName}`);

        const errorMessage = `Failed to find teams associated to member. Member ${screenName} is either not onboarded, or is not a member of any team..`;

        if (!isSuccessCode(result.status)) {
            throw new QMError(errorMessage);
        }

        let returnValue = [];

        if (!_.isEmpty(result.data._embedded)) {
            returnValue = result.data._embedded.teamResources;
        } else if (requestActionOnFailure) {
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
        }

        return returnValue;
    }

    public async gluonTeamForSlackTeamChannel(teamChannel: string): Promise<any> {
        logger.debug(`Trying to get gluon team associated to a teamChannel. teamChannel: ${teamChannel} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackTeamChannel=${teamChannel}`);

        if (!isSuccessCode(result.status) || _.isEmpty(result.data._embedded)) {
            throw new QMError(`No team associated with Slack team channel: ${teamChannel}`);
        }

        return result.data._embedded.teamResources[0];

    }

    public async getAllTeams(): Promise<any> {
        logger.debug(`Trying to get all teams.`);
        return await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams`);
    }

    public async gluonTeamByName(teamName: string): Promise<any> {
        logger.debug(`Trying to get gluon team with by name. teamName: ${teamName} `);

        return await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);
    }

    public async createGluonTeam(teamName: string, teamDescription: string, createdBy: string): Promise<any> {
        logger.debug(`Trying to create team. teamName: ${teamName}; teamDescription: ${teamDescription}; createdBy: ${createdBy}`);
        return await this.axiosInstance.post(`${QMConfig.subatomic.gluon.baseUrl}/teams`, {
            name: teamName,
            description: teamDescription,
            createdBy,
        });
    }

    public async addSlackDetailsToTeam(teamId: string, slackDetails: any): Promise<any> {
        logger.debug(`Trying to update team slack details. teamId: ${teamId}`);
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`, slackDetails);
    }

    public async addMemberToTeam(teamId: string, memberDetails: any): Promise<any> {
        logger.debug(`Trying to add member member to team. teamId: ${teamId}`);
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            memberDetails);
    }

    public async createMembershipRequest(teamId: string, membershipRequestDetails: any): Promise<any> {
        logger.debug(`Trying to create membership request. teamId: ${teamId}`);
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            membershipRequestDetails);
    }

    public async requestDevOpsEnvironment(teamId: string, memberId: string): Promise<any> {
        logger.debug(`Trying to request team devops environment. teamId: ${teamId}, memberId: ${memberId}`);
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            {
                devOpsEnvironment: {
                    requestedBy: memberId,
                },
            });
    }
}
