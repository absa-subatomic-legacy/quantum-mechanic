import {logger} from "@atomist/automation-client";
import * as _ from "lodash";
import uuid = require("uuid");
import {configuration} from "../../../atomist.config";

export class PrometheusClient  {

    public static client: any;
    public static uuid: string;
    public static counters: any[];

    public static initialize(exp) {

        PrometheusClient.client = require("prom-client");

        PrometheusClient.uuid = uuid();

        PrometheusClient.counters = [];

        logger.debug(`Original PrometheusClient.guid: ${PrometheusClient.uuid}`);

        const Counter = require("prom-client").Counter;

        // Loop through commands from atomist.config and add/register
        configuration.commands.forEach( command => {
            const cName = _.snakeCase(command.name);

            const commandCounter = new Counter({
                name: `${cName}_command`,
                help: `Count the number of times the ${command.name} command fires`,
                labelNames: ["status", "slackUsername", "team"],
            });

            PrometheusClient.counters.push(commandCounter);
        });

        // Loop through events from atomist.config and add/register
        configuration.events.forEach( event => {
            const eName = _.snakeCase(event.name);

            const eventCounter = new Counter({
                name: `${eName}_event`,
                help: `Count the number of times the ${event.name} event fires`,
                labelNames: ["classname"],
            });

            PrometheusClient.counters.push(eventCounter);
        });

        exp.get("/prometrics", async (req, res) => {
            res.set("Content-Type", PrometheusClient.client.register.contentType);
            res.end(PrometheusClient.client.register.metrics());
        });
    }

    public static incrementCounter(name: string, labels: any) {
        logger.debug(`incrementCounter name: ${name} labels: ${labels}`);
        // PrometheusClient.counters.find( counter => counter.name === name).inc(labels);
    }
}
