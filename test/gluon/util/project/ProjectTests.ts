import assert = require("power-assert");
import {
    getDeploymentEnvironmentNamespacesFromDeploymentPipeline,
    getDeploymentEnvironmentNamespacesFromDeploymentPipelines,
    getDeploymentEnvironmentNamespacesFromProject,
    getProjectDevOpsId,
    getProjectDisplayName,
    getProjectOpenshiftNamespace,
    QMProject,
} from "../../../../src/gluon/util/project/Project";

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

describe("getDeploymentEnvironmentNamespacesFromProject", () => {
    it("should return all namespaces for all pipelines in a project", async () => {
        const project: QMProject = {
            projectId: "",
            bitbucketProject: null,
            owningTeam: null,
            owningTenant: "default",
            name: "Project",
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

        const deploymentEnvironmentNamespaces = getDeploymentEnvironmentNamespacesFromProject("default", project);
        assert.equal(deploymentEnvironmentNamespaces.length, 4);
        assert.equal(deploymentEnvironmentNamespaces[0], "default-project-dev");
        assert.equal(deploymentEnvironmentNamespaces[1], "default-project-sit");
        assert.equal(deploymentEnvironmentNamespaces[2], "default-project-uat");
        assert.equal(deploymentEnvironmentNamespaces[3], "default-project-another-another");
    });

});

describe("getDeploymentEnvironmentNamespacesFromDeploymentPipelines", () => {
    it("should return all namespaces for all pipelines specified", async () => {
        const pipelines = [
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
        ];
        const deploymentEnvironmentNamespaces = getDeploymentEnvironmentNamespacesFromDeploymentPipelines("default", "project", pipelines);
        assert.equal(deploymentEnvironmentNamespaces.length, 2);
        assert.equal(deploymentEnvironmentNamespaces[0], "default-project-uat");
        assert.equal(deploymentEnvironmentNamespaces[1], "default-project-another-another");
    });
});

describe("getDeploymentEnvironmentNamespacesFromDeploymentPipeline", () => {
    it("should return all namespaces for the pipeline specified", async () => {
        const pipeline = {
            name: "Something",
            tag: "something",
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
        const deploymentEnvironmentNamespaces = getDeploymentEnvironmentNamespacesFromDeploymentPipeline("default", "project", pipeline);
        assert.equal(deploymentEnvironmentNamespaces.length, 2);
        assert.equal(deploymentEnvironmentNamespaces[0], "default-project-something-dev");
        assert.equal(deploymentEnvironmentNamespaces[1], "default-project-something-sit");
    });
});

describe("getPipelineOpenShiftNamespacesForOpenShiftCluster", () => {

});
