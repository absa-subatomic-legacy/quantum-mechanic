import assert = require("power-assert");
import {OpenShiftConfig} from "../../../../src/config/OpenShiftConfig";
import {
    getAllPipelineOpenshiftNamespaces,
    getAllPipelineOpenshiftNamespacesForAllPipelines,
    getDeploymentEnvironmentJenkinsMetadata,
    getPipelineOpenShiftNamespacesForOpenShiftCluster,
    getProjectDevOpsId,
    getProjectDisplayName,
    getProjectOpenshiftNamespace,
    } from "../../../../src/gluon/util/project/Project";
import {
    QMDeploymentPipeline,
    QMProject,
} from "../../../../src/gluon/util/transform/types/gluon/Project";

describe("getProjectOpenshiftNamespace", () => {
    it("with pipelineTag should return namespace including tag", async () => {
        const projectOpenshiftNamespace = getProjectOpenshiftNamespace("tenant", "project", "pipelinetag", "dev");

        assert.equal(projectOpenshiftNamespace, `tenant-project-pipelinetag-dev`);
    });

    it("with empty pipelineTag should return namespace excluding tag", async () => {
        const projectOpenshiftNamespace = getProjectOpenshiftNamespace("tenant", "project", "", "dev");

        assert.equal(projectOpenshiftNamespace, `tenant-project-dev`);
    });
});

describe("getProjectDevOpsId", () => {
    it("should return a kebab case formatted devops namespace", async () => {
        const devopsProjectId = getProjectDevOpsId("Some Team Name");

        assert.equal(devopsProjectId, "some-team-name-devops");
    });

    it("with numbers is team name should return a kebab case formatted devops namespace", async () => {
        const devopsProjectId = getProjectDevOpsId("Some Team Name 5");

        assert.equal(devopsProjectId, "some-team-name-5-devops");
    });
});

describe("getProjectDisplayName", () => {
    it("with pipelineTag should return displayable name including tag", async () => {
        const projectOpenshiftNamespace = getProjectDisplayName("default", "Project", "Pipelinetag", "Dev");

        assert.equal(projectOpenshiftNamespace, `Project Pipelinetag Dev`);
    });

    it("with empty pipelineTag should return displayable name excluding tag", async () => {
        const projectOpenshiftNamespace = getProjectDisplayName("default", "Project", "", "Dev");

        assert.equal(projectOpenshiftNamespace, `Project Dev`);
    });

    it("with non default tenant should return displayable name including tenant", async () => {
        const projectOpenshiftNamespace = getProjectDisplayName("Tenant", "Project", "", "Dev");

        assert.equal(projectOpenshiftNamespace, `Tenant Project Dev`);
    });
});

describe("getPipelineOpenShiftNamespacesForOpenShiftCluster", () => {
    it("should return all cluster environment namespaces for specified pipeline", async () => {
        const project: QMProject = {
            projectId: "",
            description: "",
            bitbucketProject: null,
            owningTeam: null,
            owningTenant: "default",
            name: "Project",
            devDeploymentPipeline: {
                name: "Something",
                tag: "somethingtag",
                pipelineId: "1",
                environments: [],
            },
            releaseDeploymentPipelines: [],
        };

        const cluster: OpenShiftConfig = {
            internalDockerRegistryUrl: "",
            externalDockerRegistryUrl: "externalurl",
            auth: {token: ""},
            masterUrl: "",
            name: "",
            usernameCase: "upper",
            defaultEnvironments: [
                {description: "DEV", id: "dev"},
                {description: "UAT", id: "uat"},
            ],
        };

        const deploymentEnvironmentNamespaces = getPipelineOpenShiftNamespacesForOpenShiftCluster("default", project, project.devDeploymentPipeline, cluster);
        assert.equal(deploymentEnvironmentNamespaces.length, 2);
        assert.equal(deploymentEnvironmentNamespaces[0].namespace, "default-project-somethingtag-dev");
        assert.equal(deploymentEnvironmentNamespaces[0].displayName, "Project Something DEV");
        assert.equal(deploymentEnvironmentNamespaces[0].postfix, "somethingtag-dev");
        assert.equal(deploymentEnvironmentNamespaces[1].namespace, "default-project-somethingtag-uat");
        assert.equal(deploymentEnvironmentNamespaces[1].displayName, "Project Something UAT");
        assert.equal(deploymentEnvironmentNamespaces[1].postfix, "somethingtag-uat");
    });
});

describe("getAllPipelineOpenshiftNamespacesForAllPipelines", () => {
    it("should return all OpenShiftNamespaces for all pipelines in a project", async () => {
        const project: QMProject = {
            projectId: "",
            bitbucketProject: null,
            owningTeam: null,
            owningTenant: "default",
            name: "Project",
            description: "",
            devDeploymentPipeline: {
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
            },
            releaseDeploymentPipelines: [
                {
                    name: "Default",
                    tag: "",
                    pipelineId: "1",
                    environments: [
                        {
                            postfix: "uat",
                            displayName: "UAT",
                            positionInPipeline: 0,
                        },
                    ],
                },
                {
                    name: "Another",
                    tag: "another",
                    pipelineId: "2",
                    environments: [
                        {
                            postfix: "another",
                            displayName: "Another",
                            positionInPipeline: 0,
                        },
                    ],
                },
            ],
        };

        const deploymentEnvironmentNamespaces = getAllPipelineOpenshiftNamespacesForAllPipelines("default", project);
        assert.equal(deploymentEnvironmentNamespaces.length, 4);
        assert.equal(deploymentEnvironmentNamespaces[0].namespace, "default-project-dev");
        assert.equal(deploymentEnvironmentNamespaces[0].displayName, "Project Dev");
        assert.equal(deploymentEnvironmentNamespaces[0].postfix, "dev");
        assert.equal(deploymentEnvironmentNamespaces[1].namespace, "default-project-sit");
        assert.equal(deploymentEnvironmentNamespaces[1].displayName, "Project SIT");
        assert.equal(deploymentEnvironmentNamespaces[1].postfix, "sit");
        assert.equal(deploymentEnvironmentNamespaces[2].namespace, "default-project-uat");
        assert.equal(deploymentEnvironmentNamespaces[2].displayName, "Project UAT");
        assert.equal(deploymentEnvironmentNamespaces[2].postfix, "uat");
        assert.equal(deploymentEnvironmentNamespaces[3].namespace, "default-project-another-another");
        assert.equal(deploymentEnvironmentNamespaces[3].displayName, "Project Another Another");
        assert.equal(deploymentEnvironmentNamespaces[3].postfix, "another-another");
    });

});

describe("getAllPipelineOpenshiftNamespacesForAllPipelines", () => {
    it("should return all OpenShiftNamespaces for all pipelines in a project", async () => {
        const pipeline: QMDeploymentPipeline = {
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

        const deploymentEnvironmentNamespaces = getAllPipelineOpenshiftNamespaces("default", "Project", pipeline);
        assert.equal(deploymentEnvironmentNamespaces.length, 2);
        assert.equal(deploymentEnvironmentNamespaces[0].namespace, "default-project-dev");
        assert.equal(deploymentEnvironmentNamespaces[0].displayName, "Project Dev");
        assert.equal(deploymentEnvironmentNamespaces[0].postfix, "dev");
        assert.equal(deploymentEnvironmentNamespaces[1].namespace, "default-project-sit");
        assert.equal(deploymentEnvironmentNamespaces[1].displayName, "Project SIT");
        assert.equal(deploymentEnvironmentNamespaces[1].postfix, "sit");
    });

});

describe("getDeploymentEnvironmentJenkinsMetadata", () => {
    it("should return correct meta data for default tenant", async () => {
        const pipeline: QMDeploymentPipeline = {
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

        const cluster: OpenShiftConfig = {
            internalDockerRegistryUrl: "internalUrl",
            externalDockerRegistryUrl: "externalUrl",
            auth: {token: "token"},
            masterUrl: "masterIr;",
            name: "clusterName",
            usernameCase: "upper",
            defaultEnvironments: [
                {description: "DEV", id: "dev"},
                {description: "UAT", id: "uat"},
            ],
        };

        const environmentJenkinsMetadata = getDeploymentEnvironmentJenkinsMetadata("default", "Project", pipeline, pipeline.environments[0], cluster);
        assert.equal(environmentJenkinsMetadata.displayName, "Project Pipeline Dev");
        assert.equal(environmentJenkinsMetadata.postfix, "pipeline-dev");
        assert.equal(environmentJenkinsMetadata.clusterName, "clusterName");
        assert.equal(environmentJenkinsMetadata.clusterExternalDockerRegistryUrl, "externalUrl");
    });
    it("should return correct meta data for non default tenant", async () => {
        const pipeline: QMDeploymentPipeline = {
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

        const cluster: OpenShiftConfig = {
            internalDockerRegistryUrl: "internalUrl",
            externalDockerRegistryUrl: "externalUrl",
            auth: {token: "token"},
            masterUrl: "masterIr;",
            name: "clusterName",
            usernameCase: "upper",
            defaultEnvironments: [
                {description: "DEV", id: "dev"},
                {description: "UAT", id: "uat"},
            ],
        };

        const environmentJenkinsMetadata = getDeploymentEnvironmentJenkinsMetadata("something", "Project", pipeline, pipeline.environments[0], cluster);
        assert.equal(environmentJenkinsMetadata.displayName, "something Project Pipeline Dev");
        assert.equal(environmentJenkinsMetadata.postfix, "pipeline-dev");
        assert.equal(environmentJenkinsMetadata.clusterName, "clusterName");
        assert.equal(environmentJenkinsMetadata.clusterExternalDockerRegistryUrl, "externalUrl");
    });

    it("should return correct meta data for default pipeline with no tag", async () => {
        const pipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            pipelineId: "1",
            environments: [
                {
                    postfix: "dev",
                    displayName: "Dev",
                    positionInPipeline: 0,
                },
            ],
        };

        const cluster: OpenShiftConfig = {
            internalDockerRegistryUrl: "internalUrl",
            externalDockerRegistryUrl: "externalUrl",
            auth: {token: "token"},
            masterUrl: "masterIr;",
            name: "clusterName",
            usernameCase: "upper",
            defaultEnvironments: [
                {description: "DEV", id: "dev"},
                {description: "UAT", id: "uat"},
            ],
        };

        const environmentJenkinsMetadata = getDeploymentEnvironmentJenkinsMetadata("something", "Project", pipeline, pipeline.environments[0], cluster);
        assert.equal(environmentJenkinsMetadata.displayName, "something Project Dev");
        assert.equal(environmentJenkinsMetadata.postfix, "dev");
        assert.equal(environmentJenkinsMetadata.clusterName, "clusterName");
        assert.equal(environmentJenkinsMetadata.clusterExternalDockerRegistryUrl, "externalUrl");
    });
});
