import {HandlerContext, logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {OnboardMember} from "../../commands/member/OnboardMember";
import {AwaitAxios} from "../../util/shared/AwaitAxios";
import {QMError} from "../../util/shared/Error";
import {isSuccessCode} from "../../util/shared/Http";

export class MemberService {

    constructor(public axiosInstance = new AwaitAxios()) {
    }

    public async gluonMemberFromScreenName(ctx: HandlerContext,
                                           screenName: string,
                                           requestOnboardingIfFailure: boolean = true): Promise<any> {
        logger.info(`Trying to get gluon member from screen name. screenName: ${screenName} `);

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${screenName}`);
        if (!isSuccessCode(result.status) || _.isEmpty(result.data._embedded)) {
            const errorMessage = `Failed to get member details. Member ${screenName} appears to not be onboarded.`;
            if (requestOnboardingIfFailure) {
                const msg: SlackMessage = {
                    text: "This command requires the member to be onboarded onto subatomic",
                    attachments: [{
                        text: `
Unfortunately you do not seem to have been onboarded to Subatomic.
To create a team you must first onboard yourself. Click the button below to do that now.
                            `,
                        fallback: "You are not onboarded to Subatomic",
                        footer: `For more information, please read the ${url(`${QMConfig.subatomic.docs.baseUrl}/teams`,
                            "documentation")}`,
                        color: "#ffcc00",
                        mrkdwn_in: ["text"],
                        thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Onboard me",
                                },
                                new OnboardMember()),
                        ],
                    }],
                };
                await ctx.messageClient.addressUsers(msg, screenName);
                throw new QMError(`Member ${screenName} appears to not be onboarded. Please retry once they have been onboarded.`);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.teamMemberResources[0];
    }

    public async gluonMemberFromEmailAddress(emailAddress: string): Promise<any> {
        logger.debug(`Trying to get member from email address. emailAddress: ${emailAddress}`);
        return await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/members?email=${emailAddress}`);
    }

    public async gluonMemberFromMemberId(memberId: string): Promise<any> {
        logger.debug(`Trying to get member from memberId. memberId: ${memberId}`);
        return await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/members/${memberId}`);
    }

    public async createGluonMember(teamMemberDetails: any): Promise<any> {
        logger.debug(`Trying to create gluon member.`);
        return await this.axiosInstance.post(`${QMConfig.subatomic.gluon.baseUrl}/members`,
            teamMemberDetails);
    }

    public async updateGluonMembershipRequest(teamId: string, membershipRequestDetails: any): Promise<any> {
        logger.debug(`Trying to update membership request. teamId: ${teamId}`);
        return await this.axiosInstance.put(
            `${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            membershipRequestDetails);
    }

    public async updateMemberSlackDetails(memberId: string, slackDetails: any): Promise<any> {
        logger.debug(`Trying to update member slack details. memberId: ${memberId}`);
        return await this.axiosInstance.put(
            `${QMConfig.subatomic.gluon.baseUrl}/members/${memberId}`, slackDetails);
    }
}
