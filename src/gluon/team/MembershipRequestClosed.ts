import {
    CommandHandler, failure, HandleCommand, HandlerContext, HandlerResult,
    logger, MappedParameter, MappedParameters, Parameter, success, Tags,
} from "@atomist/automation-client";
import {
    addressSlackUsers,
} from "@atomist/automation-client/spi/message/MessageClient";
import {inviteUserToSlackChannel} from "@atomist/lifecycle-automation/handlers/command/slack/AssociateRepo";
import {SlackMessage} from "@atomist/slack-messages";
import axios from "axios";
import * as config from "config";

@CommandHandler("Close a membership request", config.get("subatomic").commandPrefix + " close membership request")
@Tags("subatomic", "team", "membership")
export class MembershipRequestClosed implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public approverUserName: string;

    @MappedParameter(MappedParameters.SlackTeam)
    public slackTeam: string;

    @MappedParameter(MappedParameters.SlackChannel)
    public slackChannelId: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "Gluon team id",
    })
    public teamId: string;

    @Parameter({
        description: "Name of the team",
    })
    public teamName: string;

    @Parameter({
        description: "Membership request id",
    })
    public membershipRequestId: string;

    @Parameter({
        description: "Slack name of applying user",
    })
    public userScreenName: string;

    @Parameter({
        description: "Slack id of applying user",
    })
    public userSlackId: string;

    @Parameter({
        description: "Status of request approval",
    })
    public approvalStatus: string;

    public handle(ctx: HandlerContext): Promise<HandlerResult> {

        logger.info(`Attempting approval from user: ${this.approverUserName}`);

        return axios.get(`http://localhost:8080/members?slackScreenName=${this.approverUserName}`)
            .then(newMember => {
                logger.info(`Member: ${JSON.stringify(newMember.data)}`);
                return axios.put(`http://localhost:8080/teams/${this.teamId}`,
                    {
                        membershipRequests: [
                            {
                                membershipRequestId: this.membershipRequestId,
                                approvedBy: {
                                    memberId: newMember.data._embedded.teamMemberResources[0].memberId,
                                },
                                requestStatus: this.approvalStatus,
                            }],
                    }).then(() => {
                    if (this.approvalStatus === "APPROVED") {
                        logger.info(`Added team member! Inviting to channel [${this.slackChannelId}] -> member @${this.userScreenName}`);
                        return inviteUserToSlackChannel(ctx,
                            this.slackTeam,
                            this.slackChannelId,
                            this.userSlackId)
                            .then(() => {
                                const msg: SlackMessage = {
                                    text: `Welcome to the team *@${this.userScreenName}*!`,
                                };

                                return ctx.messageClient.addressChannels(msg, this.teamChannel);
                            }, reason => logger.error(reason));
                    } else {
                        return ctx.messageClient.send(`Your membership request to team '${this.teamName}' has been rejected by @${this.approverUserName}`,
                            addressSlackUsers(config.get("teamId"), this.userScreenName))
                            .then(() => {
                                return ctx.messageClient.addressChannels("Membership request rejected", this.teamChannel);
                            });
                    }
                }).catch(error => failure(error));
            });

    }
}
