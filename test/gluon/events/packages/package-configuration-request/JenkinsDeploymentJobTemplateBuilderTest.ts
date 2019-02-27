import assert = require("power-assert");
import {buildJenkinsDeploymentJobTemplates} from "../../../../../src/gluon/events/packages/package-configuration-request/JenkinsDeploymentJobTemplateBuilder";
import {QMDeploymentPipeline} from "../../../../../src/gluon/util/project/Project";

describe("buildJenkinsDeploymentJobTemplates", () => {
    it("with single release pipeline should return correct template", async () => {

        const devDeploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            pipelineId: "1",
            environments: [
                {
                    postfix: "dev",
                    displayName: "Dev",
                    positionInPipeline: 0,
                },
                {
                    postfix: "sit",
                    displayName: "SIT",
                    positionInPipeline: 1,
                },
            ],
        };

        const releaseDeploymentPipelines: QMDeploymentPipeline [] = [
            {
                name: "Default",
                tag: "",
                pipelineId: "1",
                environments: [
                    {
                        postfix: "uat",
                        displayName: "UAT",
                        positionInPipeline: 0,
                    }, {
                        postfix: "preprod",
                        displayName: "Pre Prod",
                        positionInPipeline: 1,
                    },
                ],
            },
        ];

        const jenkinsDeploymentJobTemplates = buildJenkinsDeploymentJobTemplates("default", "Demo", devDeploymentPipeline, releaseDeploymentPipelines);

        assert.equal(jenkinsDeploymentJobTemplates.length, 2);
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.postfix, "sit");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.displayName, "Demo SIT");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironment.postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironment.displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[0].expectedJenkinsfile, "Jenkinsfile.uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobNamePostfix, "-uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironment.postfix, "preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironment.displayName, "Demo Pre Prod");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[1].expectedJenkinsfile, "Jenkinsfile.preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].jobNamePostfix, "-preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");

    });

    it("with multiple release pipeline should return correct template", async () => {

        const devDeploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            pipelineId: "1",
            environments: [
                {
                    postfix: "dev",
                    displayName: "Dev",
                    positionInPipeline: 0,
                },
                {
                    postfix: "sit",
                    displayName: "SIT",
                    positionInPipeline: 1,
                },
            ],
        };

        const releaseDeploymentPipelines: QMDeploymentPipeline [] = [
            {
                name: "Default",
                tag: "",
                pipelineId: "1",
                environments: [
                    {
                        postfix: "uat",
                        displayName: "UAT",
                        positionInPipeline: 0,
                    }, {
                        postfix: "preprod",
                        displayName: "Pre Prod",
                        positionInPipeline: 1,
                    },
                ],
            },
            {
                name: "Another",
                tag: "another",
                pipelineId: "2",
                environments: [
                    {
                        postfix: "uat",
                        displayName: "UAT",
                        positionInPipeline: 0,
                    },
                ],
            },
        ];

        const jenkinsDeploymentJobTemplates = buildJenkinsDeploymentJobTemplates("default", "Demo", devDeploymentPipeline, releaseDeploymentPipelines);

        assert.equal(jenkinsDeploymentJobTemplates.length, 3);
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.postfix, "sit");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.displayName, "Demo SIT");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironment.postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironment.displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[0].expectedJenkinsfile, "Jenkinsfile.uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobNamePostfix, "-uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironment.postfix, "preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironment.displayName, "Demo Pre Prod");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[1].expectedJenkinsfile, "Jenkinsfile.preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].jobNamePostfix, "-preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");
        assert.equal(jenkinsDeploymentJobTemplates[2].sourceEnvironment.postfix, "sit");
        assert.equal(jenkinsDeploymentJobTemplates[2].sourceEnvironment.displayName, "Demo SIT");
        assert.equal(jenkinsDeploymentJobTemplates[2].deploymentEnvironment.postfix, "another-uat");
        assert.equal(jenkinsDeploymentJobTemplates[2].deploymentEnvironment.displayName, "Demo Another UAT");
        assert.equal(jenkinsDeploymentJobTemplates[2].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[2].expectedJenkinsfile, "Jenkinsfile.another.uat");
        assert.equal(jenkinsDeploymentJobTemplates[2].jobNamePostfix, "-another-uat");
        assert.equal(jenkinsDeploymentJobTemplates[2].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");

    });
});
