import {logger} from "@atomist/automation-client";
import * as cluster from "cluster";
import * as _ from "lodash";
import {AggregatorRegistry} from "prom-client";
import uuid = require("uuid");

export class PrometheusClient {

    public static client: any;
    public static aggregatorRegistry: any;
    public static uuid: string;
    public static counters: any[];

    public static initializePromClient(atomistConfiguration: any) {
        try {
            PrometheusClient.client = require("prom-client");
            PrometheusClient.aggregatorRegistry = require("prom-client").AggregatorRegistry;
            PrometheusClient.aggregatorRegistry.registry = new AggregatorRegistry();

            PrometheusClient.uuid = uuid();

            PrometheusClient.counters = [];

            logger.debug(`Original PrometheusClient.guid: ${PrometheusClient.uuid}`);

            const Counter = require("prom-client").Counter;

            // Loop through commands from atomist.config and register a counter for each
            atomistConfiguration.commands.forEach(command => {
                const cName = _.snakeCase(command.name);

                const commandCounter = new Counter({
                    name: `${cName}_command`,
                    help: `Count the number of times the ${command.name} command fires`,
                    labelNames: ["status", "slackUsername", "team"],
                });

                PrometheusClient.counters.push(commandCounter);
            });

            // Loop through events from atomist.config and register a counter for each
            atomistConfiguration.events.forEach(event => {
                const eName = _.snakeCase(event.name);

                const eventCounter = new Counter({
                    name: `${eName}_event`,
                    help: `Count the number of times the ${event.name} event fires`,
                    labelNames: ["classname"],
                });

                PrometheusClient.counters.push(eventCounter);
            });
        } catch (error) {
            logger.error(`initializePromClient.initializeMetricsServer exception: ${error}`);
        }
    }

    public static initializeMetricsServer(exp) {
        try {
            if (cluster.isMaster) {
                // set up prometheus metrics endpoint
                exp.get("/cluster_prometrics", (req, res) => {
                    PrometheusClient.aggregatorRegistry.registry.clusterMetrics((err, metrics) => {
                        res.set("Content-Type", PrometheusClient.aggregatorRegistry.registry.contentType);
                        res.send(metrics);
                        if (err) {
                            console.log(err);
                        }
                    });
                });
            }
        } catch (error) {
            logger.error(`PrometheusClient.initializeMetricsServer exception: ${error}`);
        }
    }

    public static incrementCounter(name: string, labels: any) {
        try {
            logger.debug(`incrementCounter name: ${name} labels: ${labels}`);
            PrometheusClient.counters.find(counter => counter.name === name).inc(labels);
        } catch (error) {
            logger.error(`PrometheusClient.incrementCounter exception: ${error}`);
        }
    }
}
