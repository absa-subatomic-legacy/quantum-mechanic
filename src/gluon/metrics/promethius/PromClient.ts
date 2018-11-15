import {logger} from "@atomist/automation-client";
import {configuration} from "../../../atomist.config";

export class PromethiusClient  {

    public static client: any;
    public static guid: string;
    public static counters: any[];

    public static initialize(exp) {

        PromethiusClient.client = require("prom-client");
        // PromethiusClient.client.collectDefaultMetrics();

        PromethiusClient.guid = Math.random().toString(36).substring(2)
            + (new Date()).getTime().toString(36); // create guid to check if same instance

        PromethiusClient.counters = [];

        logger.debug(`Original PromethiusClient.guid: ${PromethiusClient.guid}`); // output guid

        const Counter = require("prom-client").Counter;

        // Loop through commands from atomist.config and add/register
        configuration.commands.forEach( command => {
            const cName = PromethiusClient.convertToSnake(command.name);

            const commandCounter = new Counter({
                name: `${cName}_command`,
                help: `Count the number of times the ${command.name} command fires`,
                labelNames: ["code"],
            });

            PromethiusClient.counters.push(commandCounter);
        });

        // Loop through events from atomist.config and add/register
        configuration.events.forEach( event => {
            const eName = PromethiusClient.convertToSnake(event.name);

            const eventCounter = new Counter({
                name: `${eName}_event`,
                help: `Count the number of times the ${event.name} event fires`,
                labelNames: ["code"],
            });

            PromethiusClient.counters.push(eventCounter);
        });

        exp.get("/prometrics", async (req, res) => {
            res.set("Content-Type", PromethiusClient.client.register.contentType);
            res.end(PromethiusClient.client.register.metrics());
        });
    }

    public static incrementCounter(name: string) {
        PromethiusClient.counters.find( counter => counter.name === name).inc();
    }

    private static convertToSnake( myStr ) {
        return myStr.replace( /([a-z])([A-Z])/g, "$1_$2" ).toLowerCase();
    }

}
