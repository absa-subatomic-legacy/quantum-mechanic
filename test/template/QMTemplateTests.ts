import assert = require("power-assert");
import {QMTemplate} from "../../src/template/QMTemplate";

describe("QMTemplate.ifCond", () => {
    it("with == should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond greeting '==' 'hi'}}{{greeting}}{{else}}!{{greeting}}{{/ifCond}}");

        assert.equal(qmTemplate.build({greeting: "hi"}), `hi`);
    });

    it("with == should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond greeting '==' 'hi'}}{{greeting}}{{else}}!{{greeting}}{{/ifCond}}");

        assert.equal(qmTemplate.build({greeting: "not hi"}), `!not hi`);
    });

    it("with != should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond greeting '!=' 'hi'}}{{greeting}}{{else}}!{{greeting}}{{/ifCond}}");

        assert.equal(qmTemplate.build({greeting: "not hi"}), `not hi`);
    });

    it("with != should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond greeting '!=' 'hi'}}{{greeting}}{{else}}!{{greeting}}{{/ifCond}}");

        assert.equal(qmTemplate.build({greeting: "hi"}), `!hi`);
    });

    it("with < should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 1 '<' 2}}less{{else}}greater{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `less`);
    });

    it("with < should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 3 '<' 2}}less{{else}}greater{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `greater`);
    });

    it("with > should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 2 '>' 1}}greater{{else}}less{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `greater`);
    });

    it("with > should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 1 '>' 2}}greater{{else}}less{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `less`);
    });

    it("with <= should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 1 '<=' 2}}leq{{else}}greater{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `leq`);
    });

    it("with <= should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 3 '<=' 2}}leq{{else}}greater{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `greater`);
    });

    it("with >= should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 2 '>=' 1}}geq{{else}}less{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `geq`);
    });

    it("with >= should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond 1 '>=' 2}}greater{{else}}less{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `less`);
    });

    it("with && should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond true '&&' true}}true{{else}}false{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `true`);
    });

    it("with && should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond true '&&' false}}true{{else}}false{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `false`);
    });

    it("with || should return true branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond true '||' false}}true{{else}}false{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `true`);
    });

    it("with || should return false branch", async () => {
        const qmTemplate = new QMTemplate("{{#ifCond false '||' false}}true{{else}}false{{/ifCond}}");

        assert.equal(qmTemplate.build({}), `false`);
    });
});
