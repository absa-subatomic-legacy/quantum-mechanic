import * as config from "config";
import {LogstashConfig} from "./LogstashConfig";

export class AbsaConfig {

    public static logstash: LogstashConfig = config.get("logstash");

}
