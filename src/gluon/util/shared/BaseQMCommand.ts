import {
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import * as _ from "lodash";
import {PrometheusClient} from "../../metrics/prometheus/PrometheusClient";
import {BaseQMHandler} from "./BaseQMHandler";

export abstract class BaseQMComand extends BaseQMHandler implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    public abstract handle(ctx: HandlerContext);

    protected succeedCommand(message?: string) {
        this.succeedHandler(message);

        logger.debug(`teamChannel for prometheus ${this.teamChannel}`);

        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_command`, {
            status: "success",
            slackUsername: this.screenName,
            team: this.teamChannel,
        });
    }

    protected failCommand(message?: string) {
        this.failHandler(message);
        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_command`, {
            status: "fail",
            slackUsername: this.screenName,
            team: this.teamChannel,
        });
    }
}
