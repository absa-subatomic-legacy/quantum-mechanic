import _ = require("lodash");
import {OpenShiftConfig} from "../../../../config/OpenShiftConfig";
import {
    getDefaultProdJenkinsFileName,
    getEnvironmentDeploymentJenkinsfilePostfix,
    getEnvironmentDeploymentJenkinsJobPostfix,
} from "../../../util/jenkins/Jenkins";
import {
    getJenkinsMultiBranchDeploymentJobTemplateFile,
    getJenkinsProdJobTemplateFile,
    JenkinsDeploymentJobTemplate,
} from "../../../util/jenkins/JenkinsJobTemplates";
import {getHighestPreProdEnvironment} from "../../../util/openshift/Helpers";
import {
    getDeploymentEnvironmentJenkinsMetadata,
    JenkinsProjectMetadata,
    QMDeploymentPipeline,
} from "../../../util/project/Project";

export function buildJenkinsDeploymentJobTemplates(tenantName: string, projectName: string, devDeploymentPipeline: QMDeploymentPipeline, releaseDeploymentPipelines: QMDeploymentPipeline[], clusterDetails: { name: string, externalDockerRegistryUrl: string }) {
    const jenkinsDeploymentJobTemplates: JenkinsDeploymentJobTemplate[] = [];
    for (const releasePipeline of releaseDeploymentPipelines) {
        let lastDeploymentEnvironmentMetadata: JenkinsProjectMetadata = getDeploymentEnvironmentJenkinsMetadata(tenantName, projectName, devDeploymentPipeline, getHighestPreProdEnvironment(devDeploymentPipeline), clusterDetails);
        for (const deploymentEnvironment of releasePipeline.environments) {
            const deploymentEnvironmentJenkinsMetadata = getDeploymentEnvironmentJenkinsMetadata(tenantName, projectName, releasePipeline, deploymentEnvironment, clusterDetails);
            const sourceJenkinsfile = "jenkinsfile.deployment";
            const expectedJenkinsfile = `Jenkinsfile${getEnvironmentDeploymentJenkinsfilePostfix(releasePipeline.tag, deploymentEnvironment.postfix)}`;
            const jobNamePostfix = getEnvironmentDeploymentJenkinsJobPostfix(releasePipeline.tag, deploymentEnvironment.postfix);
            const jobTemplateFilename = getJenkinsMultiBranchDeploymentJobTemplateFile();
            jenkinsDeploymentJobTemplates.push(
                {
                    sourceJenkinsfile,
                    expectedJenkinsfile,
                    sourceEnvironment: lastDeploymentEnvironmentMetadata,
                    deploymentEnvironments: [deploymentEnvironmentJenkinsMetadata],
                    jobNamePostfix,
                    jobTemplateFilename,
                },
            );
            lastDeploymentEnvironmentMetadata = deploymentEnvironmentJenkinsMetadata;
        }
    }
    return jenkinsDeploymentJobTemplates;
}

export function buildJenkinsProdDeploymentJobTemplates(tenantName: string, projectName: string, nonProdClusterDefinition: OpenShiftConfig, openShiftProdClusterDefinitions: OpenShiftConfig[], releaseDeploymentPipeline: QMDeploymentPipeline) {
    const jenkinsDeploymentJobTemplates: JenkinsDeploymentJobTemplate[] = [];
    const prepodEnvironment: JenkinsProjectMetadata = getDeploymentEnvironmentJenkinsMetadata(tenantName, projectName, releaseDeploymentPipeline, getHighestPreProdEnvironment(releaseDeploymentPipeline), nonProdClusterDefinition);

    const prodPostfix = "prod";
    const sourceJenkinsfile = getDefaultProdJenkinsFileName();
    const expectedJenkinsfile = `Jenkinsfile${getEnvironmentDeploymentJenkinsfilePostfix(releaseDeploymentPipeline.tag, prodPostfix)}`;
    const jobNamePostfix = getEnvironmentDeploymentJenkinsJobPostfix(releaseDeploymentPipeline.tag, prodPostfix);
    const jobTemplateFilename = getJenkinsProdJobTemplateFile();
    const deploymentEnvironments = [];
    for (const prodCluster of openShiftProdClusterDefinitions) {
        for (const prodEnvironment of prodCluster.defaultEnvironments) {
            const projectMetadata = getDeploymentEnvironmentJenkinsMetadata(
                tenantName,
                projectName,
                releaseDeploymentPipeline,
                {
                    displayName: prodCluster.name,
                    postfix: _.kebabCase(prodEnvironment.id),
                },
                prodCluster,
            );

            deploymentEnvironments.push(
                projectMetadata,
            );
        }
    }

    jenkinsDeploymentJobTemplates.push(
        {
            sourceJenkinsfile,
            expectedJenkinsfile,
            sourceEnvironment: prepodEnvironment,
            deploymentEnvironments,
            jobNamePostfix,
            jobTemplateFilename,
        },
    );

    return jenkinsDeploymentJobTemplates;
}
