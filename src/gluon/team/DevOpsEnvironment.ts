import {
    CommandHandler,
    HandlerContext,
    HandlerResult, logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {gluonMemberFromScreenName} from "../member/Members";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {RecursiveParameterRequestCommand} from "../shared/RecursiveParameterRequestCommand";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
    menuForTeams,
} from "./Teams";

@CommandHandler("Check whether to create a new OpenShift DevOps environment or use an existing one", QMConfig.subatomic.commandPrefix + " request devops environment")
@Tags("subatomic", "slack", "team", "openshift", "devops")
export class NewDevOpsEnvironment extends RecursiveParameterRequestCommand {

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

    protected runCommand(ctx: HandlerContext) {
        return this.requestDevOpsEnvironment(
            ctx,
            this.screenName,
            this.teamName,
            this.teamChannel,
        );
    }

    protected setNextParameter(ctx: HandlerContext): Promise<HandlerResult> | void {
        if (_.isEmpty(this.teamName)) {
            return gluonTeamForSlackTeamChannel(this.teamChannel)
                .then(
                    team => {
                        this.teamName = team.name;
                        return this.requestDevOpsEnvironment(ctx, this.screenName, this.teamName, this.teamChannel);
                    },
                    () => {
                        return gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName).then(teams => {
                            return menuForTeams(
                                ctx,
                                teams,
                                this,
                                "Please select a team you would like to create a DevOps environment for");
                        }).catch(error => {
                            logErrorAndReturnSuccess(gluonTeamsWhoSlackScreenNameBelongsTo.name, error);
                        });
                    },
                );
        }
    }

    private requestDevOpsEnvironment(ctx: HandlerContext, screenName: string,
                                     teamName: string,
                                     teamChannel: string): Promise<any> {
        return gluonMemberFromScreenName(ctx, screenName)
            .then(member => {
                axios.get(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`)
                    .then(team => {
                        if (!_.isEmpty(team.data._embedded)) {
                            logger.info("Requesting DevOps environment for team: " + teamName);
                            return axios.put(`${QMConfig.subatomic.gluon.baseUrl}/teams/${team.data._embedded.teamResources[0].teamId}`,
                                {
                                    devOpsEnvironment: {
                                        requestedBy: member.memberId,
                                    },
                                });
                        }
                    })
                    .then(() => {
                        return ctx.messageClient.addressChannels({
                            text: `🚀 Your DevOps environment for *${teamName}* team, is being provisioned...`,
                        }, teamChannel);
                    });
            }).catch(error => {
                logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
            });
    }
}
