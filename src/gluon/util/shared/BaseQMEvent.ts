import * as _ from "lodash";
import {PrometheusClient} from "../../metrics/prometheus/PrometheusClient";
import {BaseQMHandler} from "./BaseQMHandler";
import {QMConfig} from "../../../config/QMConfig";

export abstract class BaseQMEvent extends BaseQMHandler {

    protected succeedEvent(message?: string) {
        if (QMConfig.proMetrics.enabled) {
            this.succeedHandler(message);
            PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_event`, { status: "success"});
        }
    }
    protected failEvent(message?: string) {
        if (QMConfig.proMetrics.enabled) {
            this.failHandler(message);
            PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_event`, { status: "fail"});
        }
    }
}
