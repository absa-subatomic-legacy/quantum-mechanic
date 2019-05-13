import assert = require("power-assert");
import {OpenShiftConfig} from "../../../../../src/config/OpenShiftConfig";
import {
    buildJenkinsDeploymentJobTemplates,
    buildJenkinsProdDeploymentJobTemplates,
} from "../../../../../src/gluon/events/packages/package-configuration-request/JenkinsDeploymentJobTemplateBuilder";
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

        const openshiftNonprodDefinition: OpenShiftConfig = {
            name: "a.nonprod.pretend",
            usernameCase: "upper",
            internalDockerRegistryUrl: "172.30.1.1:5000",
            externalDockerRegistryUrl: "registry.a.nonprod.com",
            masterUrl: "https://192.168.64.2:8443",
            auth: {
                token: "token",
            },
            defaultEnvironments: [
                {
                    id: "dev",
                    description: "DEV",
                },
            ],
        };

        const jenkinsDeploymentJobTemplates = buildJenkinsDeploymentJobTemplates("default", "Demo", devDeploymentPipeline, releaseDeploymentPipelines, openshiftNonprodDefinition);

        assert.equal(jenkinsDeploymentJobTemplates.length, 2);
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.postfix, "sit");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.displayName, "Demo SIT");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[0].expectedJenkinsfile, "Jenkinsfile.uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobNamePostfix, "-uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironments[0].postfix, "preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironments[0].displayName, "Demo Pre Prod");
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

        const openshiftNonprodDefinition: OpenShiftConfig = {
            name: "a.nonprod.pretend",
            usernameCase: "upper",
            internalDockerRegistryUrl: "172.30.1.1:5000",
            externalDockerRegistryUrl: "registry.a.nonprod.com",
            masterUrl: "https://192.168.64.2:8443",
            auth: {
                token: "token",
            },
            defaultEnvironments: [
                {
                    id: "dev",
                    description: "DEV",
                },
            ],
        };

        const jenkinsDeploymentJobTemplates = buildJenkinsDeploymentJobTemplates("default", "Demo", devDeploymentPipeline, releaseDeploymentPipelines, openshiftNonprodDefinition);

        assert.equal(jenkinsDeploymentJobTemplates.length, 3);
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.postfix, "sit");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.displayName, "Demo SIT");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[0].expectedJenkinsfile, "Jenkinsfile.uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobNamePostfix, "-uat");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.postfix, "uat");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceEnvironment.displayName, "Demo UAT");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironments[0].postfix, "preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].deploymentEnvironments[0].displayName, "Demo Pre Prod");
        assert.equal(jenkinsDeploymentJobTemplates[1].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[1].expectedJenkinsfile, "Jenkinsfile.preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].jobNamePostfix, "-preprod");
        assert.equal(jenkinsDeploymentJobTemplates[1].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");
        assert.equal(jenkinsDeploymentJobTemplates[2].sourceEnvironment.postfix, "sit");
        assert.equal(jenkinsDeploymentJobTemplates[2].sourceEnvironment.displayName, "Demo SIT");
        assert.equal(jenkinsDeploymentJobTemplates[2].deploymentEnvironments[0].postfix, "another-uat");
        assert.equal(jenkinsDeploymentJobTemplates[2].deploymentEnvironments[0].displayName, "Demo Another UAT");
        assert.equal(jenkinsDeploymentJobTemplates[2].sourceJenkinsfile, "jenkinsfile.deployment");
        assert.equal(jenkinsDeploymentJobTemplates[2].expectedJenkinsfile, "Jenkinsfile.another.uat");
        assert.equal(jenkinsDeploymentJobTemplates[2].jobNamePostfix, "-another-uat");
        assert.equal(jenkinsDeploymentJobTemplates[2].jobTemplateFilename, "jenkins-multi-branch-deployment-project.xml");

    });
});

describe("buildJenkinsProdDeploymentJobTemplates", () => {
    it("with standard input expect correct deployment template", async () => {

        const releaseDeploymentPipelines: QMDeploymentPipeline = {
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
        };

        const openshiftNonprodDefinition: OpenShiftConfig = {
            name: "a.nonprod.pretend",
            usernameCase: "upper",
            internalDockerRegistryUrl: "172.30.1.1:5000",
            externalDockerRegistryUrl: "registry.a.nonprod.com",
            masterUrl: "https://192.168.64.2:8443",
            auth: {
                token: "token",
            },
            defaultEnvironments: [
                {
                    id: "dev",
                    description: "DEV",
                },
            ],
        };

        const openshiftProdEnvironmentDefinitions: OpenShiftConfig [] = [
            {
                name: "a.prod.pretend",
                usernameCase: "upper",
                internalDockerRegistryUrl: "172.30.1.1:5000",
                externalDockerRegistryUrl: "registry.a.com",
                masterUrl: "https://192.168.64.2:8443",
                auth: {
                    token: "token",
                },
                defaultEnvironments: [
                    {
                        id: "prod",
                        description: "PROD",
                    },
                ],
            },
            {
                name: "b.prod.pretend",
                usernameCase: "upper",
                internalDockerRegistryUrl: "172.30.1.1:5000",
                externalDockerRegistryUrl: "registry.b.com",
                masterUrl: "https://192.168.64.2:8443",
                auth: {
                    token: "token",
                },
                defaultEnvironments: [
                    {
                        id: "prod-b",
                        description: "PROD",
                    },
                ],
            },
        ];
        const jenkinsDeploymentJobTemplates = buildJenkinsProdDeploymentJobTemplates("default", "Demo", openshiftNonprodDefinition, openshiftProdEnvironmentDefinitions, releaseDeploymentPipelines);

        assert.equal(jenkinsDeploymentJobTemplates.length, 1);
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.postfix, "preprod");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.displayName, "Demo Pre Prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].postfix, "prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].displayName, "Demo a.prod.pretend");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[1].postfix, "prod-b");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[1].displayName, "Demo b.prod.pretend");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceJenkinsfile, "jenkinsfile.prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].expectedJenkinsfile, "Jenkinsfile.prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobNamePostfix, "-prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobTemplateFilename, "jenkins-prod-project.xml");

    });

    it("with non default release pipeline input expect correct deployment template", async () => {

        const releaseDeploymentPipelines: QMDeploymentPipeline = {
            name: "Something",
            tag: "something",
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
        };

        const openshiftNonprodDefinition: OpenShiftConfig = {
            name: "a.nonprod.pretend",
            usernameCase: "upper",
            internalDockerRegistryUrl: "172.30.1.1:5000",
            externalDockerRegistryUrl: "registry.a.nonprod.com",
            masterUrl: "https://192.168.64.2:8443",
            auth: {
                token: "token",
            },
            defaultEnvironments: [
                {
                    id: "dev",
                    description: "DEV",
                },
            ],
        };

        const openshiftProdEnvironmentDefinitions: OpenShiftConfig [] = [
            {
                name: "a.prod.pretend",
                usernameCase: "upper",
                internalDockerRegistryUrl: "172.30.1.1:5000",
                externalDockerRegistryUrl: "registry.a.com",
                masterUrl: "https://192.168.64.2:8443",
                auth: {
                    token: "token",
                },
                defaultEnvironments: [
                    {
                        id: "prod",
                        description: "PROD",
                    },
                ],
            },
            {
                name: "b.prod.pretend",
                usernameCase: "upper",
                internalDockerRegistryUrl: "172.30.1.1:5000",
                externalDockerRegistryUrl: "registry.b.com",
                masterUrl: "https://192.168.64.2:8443",
                auth: {
                    token: "token",
                },
                defaultEnvironments: [
                    {
                        id: "prod-b",
                        description: "PROD",
                    },
                ],
            },
        ];
        const jenkinsDeploymentJobTemplates = buildJenkinsProdDeploymentJobTemplates("default", "Demo", openshiftNonprodDefinition, openshiftProdEnvironmentDefinitions, releaseDeploymentPipelines);

        assert.equal(jenkinsDeploymentJobTemplates.length, 1);
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.postfix, "something-preprod");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceEnvironment.displayName, "Demo Something Pre Prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].postfix, "something-prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[0].displayName, "Demo Something a.prod.pretend");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[1].postfix, "something-prod-b");
        assert.equal(jenkinsDeploymentJobTemplates[0].deploymentEnvironments[1].displayName, "Demo Something b.prod.pretend");
        assert.equal(jenkinsDeploymentJobTemplates[0].sourceJenkinsfile, "jenkinsfile.prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].expectedJenkinsfile, "Jenkinsfile.something.prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobNamePostfix, "-something-prod");
        assert.equal(jenkinsDeploymentJobTemplates[0].jobTemplateFilename, "jenkins-prod-project.xml");

    });
});
