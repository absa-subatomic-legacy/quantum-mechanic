import {logger} from "@atomist/automation-client";
import {ListTeamMembers} from "../../commands/team/ListTeamMembers";
export class PromethiusClient  {

    public static client: any;
    public static guid: string;
    public static counters: any[];

    public static initialize(exp) {

        // const register = require("prom-client");
        PromethiusClient.client = require("prom-client");
        PromethiusClient.client.collectDefaultMetrics();

        PromethiusClient.guid = Math.random().toString(36).substring(2)
            + (new Date()).getTime().toString(36); // create guid to check if same instance

        PromethiusClient.counters = [];

        logger.debug(`PromethiusClient.guid: ${PromethiusClient.guid}`); // output guid

        // Creat a counter
        const Counter = require("prom-client").Counter;
        const c = new Counter({
            name: "list_team_members_counter",
            help: "Tracks number of times the xyz",
            labelNames: ["code"],
        });

        // Add it to array
        PromethiusClient.counters.push(c);

        // Create another counter
        const d = new Counter({
            name: "add_member_to_team_counter",
            help: "Tracks number of times the add_member_to_team ran",
            labelNames: ["code"],
        });

        // Add it to array
        PromethiusClient.counters.push(d);

        exp.get("/prometrics", async (req, res) => {
            res.set("Content-Type", PromethiusClient.client.register.contentType);
            res.end(PromethiusClient.client.register.metrics());
        });
    }

    public static incrementCounter(name: string) {
        PromethiusClient.counters.find( counter => counter.name === name).inc();
    }

}
