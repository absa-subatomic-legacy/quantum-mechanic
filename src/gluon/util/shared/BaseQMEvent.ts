import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
} from "@atomist/automation-client";

import * as _ from "lodash";
import {PrometheusClient} from "../../metrics/prometheus/PrometheusClient";
import {BaseQMHandler} from "./BaseQMHandler";

export abstract class BaseQMEvent extends BaseQMHandler implements HandleEvent<any> {

    public abstract handle(ctx: HandlerContext);

    protected succeedEvent(message?: string) {
        this.succeedHandler(message);

        logger.debug(`teamChannel for prometheus ${this.teamChannel}`);

        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_command`, { status: "success", slackUsername: this.screenName, team: this. });
    }

    protected failEvent(message?: string) {
        this.failHandler(message);
        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_command`, { status: "fail", slackUsername: this.screenName, team: this.teamChannel });
    }
}
