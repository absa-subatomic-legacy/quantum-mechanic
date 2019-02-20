import assert = require("power-assert");
import {
    gluonApplicationNameToBuildJobName,
    gluonApplicationNameToBuildViewName,
    gluonProjectNameToJobName,
} from "../../../../src/gluon/services/jenkins/GluonToJenkinsNamesConversion";

describe("gluonApplicationNameToBuildViewName", () => {

    it("with kebab case name should return expected view name", async () => {

        const viewName = gluonApplicationNameToBuildViewName("test-app");

        assert.equal(viewName, "Test App");
    });

    it("with snake case name should return expected view name", async () => {

        const viewName = gluonApplicationNameToBuildViewName("test_app");

        assert.equal(viewName, "Test App");
    });

    it("with simple name should return expected view name", async () => {

        const viewName = gluonApplicationNameToBuildViewName("Test app");

        assert.equal(viewName, "Test App");
    });

    it("with special character name should return expected view name", async () => {

        const viewName = gluonApplicationNameToBuildViewName("test1_app!2");

        assert.equal(viewName, "Test 1 App 2");
    });
});

describe("gluonApplicationNameToBuildJobName", () => {

    it("with snake case name should return expected build job name", async () => {

        const buildName = gluonApplicationNameToBuildJobName("test_app");

        assert.equal(buildName, "test-app");
    });

    it("with simple name should return expected build job name", async () => {

        const buildName = gluonApplicationNameToBuildJobName("Test app");

        assert.equal(buildName, "test-app");
    });

    it("with special character name should return expected build job name", async () => {

        const buildName = gluonApplicationNameToBuildJobName("test1_app!2");

        assert.equal(buildName, "test-1-app-2");
    });
});

describe("gluonProjectNameToJobName", () => {

    it("with snake case name should return expected job name", async () => {

        const jobName = gluonProjectNameToJobName("test_project");

        assert.equal(jobName, "test-project");
    });

    it("with simple name should return expected job name", async () => {

        const jobName = gluonProjectNameToJobName("Test project");

        assert.equal(jobName, "test-project");
    });

    it("with special character name should return expected job name", async () => {

        const jobName = gluonProjectNameToJobName("test1_project!2");

        assert.equal(jobName, "test-1-project-2");
    });
});
