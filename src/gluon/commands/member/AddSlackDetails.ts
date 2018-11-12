import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";

@CommandHandler("Add Slack details to an existing team member", QMConfig.subatomic.commandPrefix + " add slack")
@Tags("subatomic", "member")
export class AddSlackDetails implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackUser)
    public userId: string;

    @Parameter({
        description: "email address",
        pattern: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    })
    public email: string;

    constructor(private gluonService = new GluonService()) {
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Adding Slack details for member: ${this.email}`);

        const memberQueryResult = await this.findGluonMemberByEmail(this.email);

        if (!isSuccessCode(memberQueryResult.status)) {
            logger.error(`Unable to find gluon member with email ${this.email}. Http request failed with status ${memberQueryResult.status}`);
            return await ctx.messageClient.respond(`❗No member with email ${this.email} exists.`);
        }

        const member = memberQueryResult.data._embedded.teamMemberResources[0];
        logger.info(`Found existing member: ${member.memberId}`);

        const updateMemberResult = await this.updateGluonMemberSlackDetails(this.screenName, this.userId, member.memberId);

        if (!isSuccessCode(updateMemberResult.status)) {
            logger.error(`Unable to update slack details for gluon member with email ${this.email}. Http request failed with status ${updateMemberResult.status}`);
            return await ctx.messageClient.respond(`❗Unable to update slack details for the member specified`);
        }

        return ctx.messageClient.respond({
            text: `Thanks *${member.firstName}*, your Slack details have been added to your Subatomic profile. 👍`,
        });
    }

    private async findGluonMemberByEmail(emailAddress: string) {
        return await this.gluonService.members.gluonMemberFromEmailAddress(emailAddress);
    }

    private async updateGluonMemberSlackDetails(slackScreenName: string, slackUserId: string, gluonMemberId: string) {
        return await this.gluonService.members.updateMemberSlackDetails(gluonMemberId,
            {
                slack: {
                    screenName: slackScreenName,
                    userId: slackUserId,
                },
            });
    }
}
