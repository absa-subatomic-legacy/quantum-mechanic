import {logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import axios from "axios";
import {QMConfig} from "../../../config/QMConfig";
import {OnboardMember} from "../../commands/member/Onboard";
import {QMError} from "../shared/Error";
import {isSuccessCode} from "../shared/Http";

export class MemberService {
    public async gluonMemberFromScreenName(screenName: string,
                                           requestOnboardingIfFailure: boolean = true): Promise<any> {
        logger.debug(`Trying to get gluon member from screen name. screenName: ${screenName} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${screenName}`);

        if (!isSuccessCode(result.status)) {
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
                throw new QMError(errorMessage, msg);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.teamMemberResources[0];
    }

    public async createGluonMember(teamMemberDetails: any): Promise<any> {
        return await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/members`,
            teamMemberDetails);
    }

    public async updateGluonMembershipRequest(teamId: string, membershipRequestDetails: any): Promise<any> {
        return await axios.put(
            `${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            membershipRequestDetails);
    }

    public async updateMemberSlackDetails(memberId: string, slackDetails: any): Promise<any> {
        return await axios.put(
            `${QMConfig.subatomic.gluon.baseUrl}/members/${memberId}`, slackDetails);
    }
}

export function usernameFromDomainUsername(domainUsername: string): string {
    return /[^\\]*$/.exec(domainUsername)[0];
}
