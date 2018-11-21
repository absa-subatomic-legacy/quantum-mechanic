import * as _ from "lodash";
import {PrometheusClient} from "../../metrics/prometheus/PrometheusClient";
import {BaseQMHandler} from "./BaseQMHandler";

export abstract class BaseQMEvent extends BaseQMHandler {

    protected succeedEvent(message?: string) {
        this.succeedHandler(message);
        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_event`, { status: "success"});
    }
    protected failEvent(message?: string) {
        this.failHandler(message);
        PrometheusClient.incrementCounter(`${_.snakeCase(this.constructor.name)}_event`, { status: "fail"});
    }
}
