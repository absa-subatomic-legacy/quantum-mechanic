import {logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import * as _ from "lodash";
import {inspect} from "util";
import {QMConfig} from "../../../config/QMConfig";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {JoinTeam} from "../../commands/team/JoinTeam";
import {AwaitAxios} from "../../util/shared/AwaitAxios";
import {QMError} from "../../util/shared/Error";
import {isSuccessCode} from "../../util/shared/Http";

export class TeamService {

    constructor(public axiosInstance = new AwaitAxios()) {
    }

    public async gluonTeamsWhoSlackScreenNameBelongsTo(screenName: string, requestActionOnFailure: boolean = true): Promise<any[]> {
        logger.debug(`Trying to get gluon teams associated to a screenName. screenName: ${screenName} `);

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackScreenName=${screenName}`);

        const errorMessage = `Failed to find teams associated to member. Member ${screenName} is either not onboarded, or is not a member of any team..`;

        if (!isSuccessCode(result.status)) {
            throw new QMError(errorMessage);
        }

        let returnValue = [];

        if (!_.isEmpty(result.data._embedded)) {
            returnValue = result.data._embedded.teamResources;
        } else if (requestActionOnFailure) {
            const slackMessage: SlackMessage = {
                text: "Unfortunately, you are not a member of any team. To associate this project you need to be a member of at least one teamMinimal.",
                attachments: [{
                    text: "You can either create a new team or apply to join an existing teamMinimal",
                    fallback: "You can either create a new team or apply to join an existing teamMinimal",
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

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackTeamChannel=${teamChannel}`);

        if (!isSuccessCode(result.status) || _.isEmpty(result.data._embedded)) {
            throw new QMError(`No team associated with Slack team channel: ${teamChannel}`);
        }

        return result.data._embedded.teamResources[0];

    }

    public async getAllTeams(): Promise<any> {
        logger.debug(`Trying to get all teams.`);
        return await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams`);
    }

    public async gluonTeamByName(teamName: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to get gluon team with by name. teamName: ${teamName} `);

        const teamQueryResult = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);

        if (rawResult) {
            return teamQueryResult;
        } else if (!isSuccessCode(teamQueryResult.status)) {
            logger.error(`Failed to find team ${teamName}. Error: ${inspect(teamQueryResult)}`);
            throw new QMError(`Team ${teamName} does not appear to be a valid SubAtomic team.`);
        }

        return teamQueryResult.data._embedded.teamResources[0];
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
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`, slackDetails);
    }

    public async addMemberToTeam(teamId: string, memberDetails: any): Promise<any> {
        logger.debug(`Trying to add member member to team. teamId: ${teamId}`);
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            memberDetails);
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
}
