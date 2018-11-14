// import * as  exp from "express";

export class PromethiusClient  {

    public static initialize(exp) {

        const register = require("prom-client").register;

        require("prom-client").collectDefaultMetrics();

        const Counter = require("prom-client").Counter;
        require("prom-client").collectDefaultMetrics();

        const c = new Counter({
            name: "test_counter",
            help: "Example of a counter",
            labelNames: ["code"],
        });

        exp.get("/promethius-metrics", async (req, res) => {
            res.set("Content-Type", register.contentType);
            res.end(register.metrics());
        });
    }
}
