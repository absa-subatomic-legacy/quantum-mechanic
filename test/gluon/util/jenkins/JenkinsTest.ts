import assert = require("power-assert");
import {
    getApplicationJenkinsJobDisplayName,
    getEnvironmentDeploymentJenkinsfilePostfix,
    getEnvironmentDeploymentJenkinsJobPostfix,
    getPathFromJenkinsfileName,
} from "../../../../src/gluon/util/jenkins/Jenkins";
import {QMDeploymentPipeline} from "../../../../src/gluon/util/project/Project";

describe("Jenkins getPathFromJenkinsfileName", () => {

    it("simple file name should return the correctly formatted full path filename", async () => {

        const jenkinsfileName = getPathFromJenkinsfileName("jenkinsfile");

        assert.equal(jenkinsfileName, "resources/templates/jenkins/jenkinsfile-repo/jenkinsfile.groovy");
    });
});

describe("Jenkins getEnvironmentDeploymentJenkinsfilePostfix", () => {

    it("with simple inputs should return a correctly formatted jenkinsfile postfix", async () => {

        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Pipeline",
            tag: "pipeline",
            pipelineId: "1",
            environments: [
                {
                    postfix: "dev",
                    displayName: "Dev",
                    positionInPipeline: 0,
                },
            ],
        };

        const jenkinsfilePostfix = getEnvironmentDeploymentJenkinsfilePostfix(deploymentPipeline, deploymentPipeline.environments[0]);

        assert.equal(jenkinsfilePostfix, ".pipeline.dev");
    });
});

describe("Jenkins getEnvironmentDeploymentJenkinsJobPostfix", () => {

    it("with simple inputs should return a correctly formatted jenkins deployment job name postfix", async () => {

        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Pipeline",
            tag: "pipeline",
            pipelineId: "1",
            environments: [
                {
                    postfix: "dev",
                    displayName: "Dev",
                    positionInPipeline: 0,
                },
            ],
        };

        const jenkinsfilePostfix = getEnvironmentDeploymentJenkinsJobPostfix(deploymentPipeline, deploymentPipeline.environments[0]);

        assert.equal(jenkinsfilePostfix, "-pipeline-dev");
    });
});

describe("Jenkins getApplicationJenkinsJobDisplayName", () => {

    it("with simple inputs should return a correctly formatted jenkins job display name", async () => {

        const jenkinsfilePostfix = getApplicationJenkinsJobDisplayName("An Application", "Channel1 UAT");

        assert.equal(jenkinsfilePostfix, "An Application Channel 1 UAT");
    });
});
