import {HandlerContext, logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {OnboardMember} from "../../commands/member/Onboard";

export class MemberService {
    public gluonMemberFromScreenName(ctx: HandlerContext,
                                     screenName: string,
                                     message: string = "This command requires an onboarded member"): Promise<any> {
        logger.debug(`Trying to get gluon member from screen name. screenName: ${screenName} `);

        return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${screenName}`)
            .then(members => {
                if (!_.isEmpty(members.data._embedded)) {
                    return Promise.resolve(members.data._embedded.teamMemberResources[0]);
                } else {
                    // TODO: This does not make sense. Querying a users details does not make you the user. This should be removed.
                    const msg: SlackMessage = {
                        text: message,
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

                    return ctx.messageClient.respond(msg)
                        .then(() => Promise.reject(
                            `Member with screen name ${screenName} is not onboarded`));
                }
            });
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
