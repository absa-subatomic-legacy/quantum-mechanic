import {logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import * as _ from "lodash";
import {inspect} from "util";
import {QMConfig} from "../../../config/QMConfig";
import {AwaitAxios} from "../../../http/AwaitAxios";
import {isSuccessCode} from "../../../http/Http";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {JoinTeam} from "../../commands/team/JoinTeam";
import {QMError} from "../../util/shared/Error";

export class TeamService {

    constructor(public axiosInstance = new AwaitAxios()) {
    }

    public async getTeamsWhoSlackUserIdBelongsTo(slackUserId: string, requestActionOnFailure: boolean = true): Promise<any[]> {
        logger.debug(`Trying to get gluon teams associated to a screenName. screenName: ${slackUserId} `);

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackUserId=${slackUserId}`);

        const errorMessage = `Failed to find teams associated to member. Member ${slackUserId} is either not onboarded, or is not a member of any team..`;

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

    public async getTeamsBySlackTeamChannel(teamChannel: string): Promise<any> {
        logger.debug(`Trying to get gluon team associated to a teamChannel. teamChannel: ${teamChannel} `);

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackTeamChannel=${teamChannel}`);

        if (!isSuccessCode(result.status) || _.isEmpty(result.data._embedded)) {
            throw new QMError(`No team associated with Slack team channel: ${teamChannel}`);
        }

        return result.data._embedded.teamResources;

    }

    public async getAllTeams(): Promise<any> {
        logger.debug(`Trying to get all teams.`);
        return await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams`);
    }

    public async getTeamByName(teamName: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to get gluon team with by name. teamName: ${teamName} `);

        const teamQueryResult = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);

        if (rawResult) {
            return teamQueryResult;
        } else if (!isSuccessCode(teamQueryResult.status) || _.isEmpty(teamQueryResult.data._embedded.teamResources)) {
            logger.error(`Failed to find team ${teamName}. Error: ${inspect(teamQueryResult)}`);
            throw new QMError(`Team ${teamName} does not appear to be a valid SubAtomic team.`);
        }

        return teamQueryResult.data._embedded.teamResources[0];
    }

    public async getTeamById(teamId: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to get gluon team with by name. teamId: ${teamId} `);

        const teamQueryResult = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`);

        if (rawResult) {
            return teamQueryResult;
        } else if (!isSuccessCode(teamQueryResult.status)) {
            logger.error(`Failed to find team ${teamId}. Error: ${inspect(teamQueryResult)}`);
            throw new QMError(`Team with id ${teamId} does not appear to be a valid Subatomic team.`);
        }

        return teamQueryResult.data;
    }

    public async createTeam(teamName: string, teamDescription: string, openShiftCloud: string, createdBy: string): Promise<any> {
        logger.debug(`Trying to create team. teamName: ${teamName}; teamDescription: ${teamDescription}; createdBy: ${createdBy}`);
        return await this.axiosInstance.post(`${QMConfig.subatomic.gluon.baseUrl}/teams`, {
            name: teamName,
            description: teamDescription,
            openShiftCloud,
            createdBy,
        });
    }

    public async addSlackDetailsToTeam(teamId: string,  slackUpdateDetails: any): Promise<any> {
        logger.debug(`Trying to update team slack details. teamId: ${teamId}`);
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`, slackUpdateDetails);
    }

    public async addMemberToTeam(teamId: string, memberDetails: any): Promise<any> {
        logger.debug(`Trying to add member to team. teamId: ${teamId}`);
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`, memberDetails);
    }

    public async removeMemberFromTeam(teamId: string, memberId: string, requestedById): Promise<any> {
        logger.debug(`Trying to remove member_id:${memberId} from team_id ${teamId} by requestorId ${requestedById}`);
        return await this.axiosInstance.delete(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}/members/${memberId}?requestedById=${requestedById}`);
    }

    public async createMembershipRequest(teamId: string, membershipRequestDetails: any): Promise<any> {
        logger.debug(`Trying to create membership request. teamId: ${teamId}`);
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            membershipRequestDetails);
    }

    public async requestDevOpsEnvironment(teamId: string, memberId: string): Promise<any> {
        logger.debug(`Trying to request team devops environment. teamId: ${teamId}, memberId: ${memberId}`);
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            {
                devOpsEnvironment: {
                    requestedBy: memberId,
                },
            });
    }

    public async getTeamsAssociatedToProject(projectId: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to get teams associated to project. projectId: ${projectId}`);
        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?projectId=${projectId}`);
        if (rawResult) {
            return result;
        } else if (!isSuccessCode(result.status)) {
            throw new QMError(`Unable to find any teams associated with the project ${projectId}`);
        }
        return result.data._embedded.teamResources;
    }

    public async updateTeamOpenShiftCloud(teamId: string, openShiftCloud: string, requestedByMemberId: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to update gluon team openShiftCloud. teamId: ${teamId}, openShiftCloud: ${openShiftCloud}, requestedByMemberId: ${requestedByMemberId} `);

        const teamUpdate = {
            createdBy: requestedByMemberId,
            openShiftCloud,
        };

        const teamUpdateResult = await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`, teamUpdate);

        if (rawResult) {
            return teamUpdateResult;
        } else if (!isSuccessCode(teamUpdateResult.status)) {
            logger.error(`Failed to update team ${teamId}. Error: ${inspect(teamUpdateResult)}`);
            throw new QMError(`Unable to update team with id ${teamId}. Please make sure that you are an owner of the team.`);
        }

        return teamUpdateResult.data;
    }
}
