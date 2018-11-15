import {
    HandleCommand, HandlerContext, HandlerResult, MappedParameter,
    MappedParameters,
} from "@atomist/automation-client";
import * as _ from "lodash";
import {PrometheusClient} from "../../metrics/prometheus/PrometheusClient";
import {BaseQMHandler} from "./BaseQMHandler";

export abstract class BaseQMComand extends BaseQMHandler implements HandleCommand<HandlerResult> {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName;

    public abstract handle(ctx: HandlerContext);

    protected succeedCommand(message?: string) {
        this.succeedHandler(message);
        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_command`, { status: "success", slackUsername: this.screenName });
    }

    protected failCommand(message?: string) {
        this.failHandler(message);
        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_command`, { status: "fail", slackUsername: this.screenName });
    }
}
