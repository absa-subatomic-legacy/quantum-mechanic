import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult, logger,
    MappedParameter,
    MappedParameters,
    Parameter, success,
    Tags,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
    menuForTeams,
} from "./Teams";

@CommandHandler("Check whether to create a new OpenShift DevOps environment or use an existing one", QMConfig.subatomic.commandPrefix + " request devops environment")
@Tags("subatomic", "slack", "team", "openshift", "devops")
export class NewDevOpsEnvironment implements HandleCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "team name",
        displayable: false,
        required: false,
    })
    public teamName: string;

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            return await this.requestUnsetParameters(ctx);
        }

        return await this.requestDevOpsEnvironment(
            ctx,
            this.screenName,
            this.teamName,
            this.teamChannel,
        );
    }

    private async requestUnsetParameters(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
                return await this.requestDevOpsEnvironment(ctx, this.screenName, this.teamName, this.teamChannel);
            } catch (slackChannelError) {
                const teams = await gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
                return await menuForTeams(
                    ctx,
                    teams,
                    this,
                    "Please select a team you would like to create a DevOps environment for");
            }
        }

        return await success();
    }

    private async requestDevOpsEnvironment(ctx: HandlerContext, screenName: string,
                                           teamName: string,
                                           teamChannel: string): Promise<any> {

        await ctx.messageClient.addressChannels({
            text: `🚀 Your DevOps environment for *${teamName}* team, is being provisioned...`,
        }, teamChannel);

        let member;
        try {
            member = await gluonMemberFromScreenName(ctx, screenName);
        } catch (error) {
            return logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
        }

        const teamQueryResult = await this.getGluonTeamFromTeamName(teamName);

        if (teamQueryResult.status !== 200) {
            logger.error(`Could not find gluon team ${teamName}. This should only happen if the gluon server connection dropped.`);
            return ctx.messageClient.respond(`❗Unable to find team with name ${teamName}.`);
        }

        const team = teamQueryResult.data._embedded.teamResources[0];
        logger.info("Requesting DevOps environment for team: " + teamName);

        const teamUpdateResult = await this.requestDevOpsEnvironmentThroughGluon(team.teamId, member.memberId);

        if (teamUpdateResult.status !== 201) {
            logger.error(`Unable to request ${teamName} devops environment. Error: ${JSON.stringify(teamUpdateResult)}`);
            return await ctx.messageClient.respond(`❗Unable to request devops environment for ${teamName}.`);
        }

        return await success();
    }

    private async getGluonTeamFromTeamName(teamName: string) {
        return await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`);
    }

    private async requestDevOpsEnvironmentThroughGluon(teamId: string, memberId: string) {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`,
            {
                devOpsEnvironment: {
                    requestedBy: memberId,
                },
            });
    }

}
