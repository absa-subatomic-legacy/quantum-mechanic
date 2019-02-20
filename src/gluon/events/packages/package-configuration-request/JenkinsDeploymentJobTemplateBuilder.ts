import {
    getEnvironmentDeploymentJenkinsfileNamePostfix,
    getEnvironmentDeploymentJenkinsJobPostfix,
} from "../../../util/jenkins/Jenkins";
import {
    getJenkinsMultiBranchDeploymentJobTemplate,
    JenkinsDeploymentJobTemplate,
} from "../../../util/jenkins/JenkinsJobTemplates";
import {getHighestPreProdEnvironment} from "../../../util/openshift/Helpers";
import {
    getDeploymentEnvironmentJenkinsMetadata,
    JenkinsProjectMetadata,
    QMDeploymentPipeline,
} from "../../../util/project/Project";

export function buildJenkinsDeploymentJobTemplates(tenantName: string, projectName: string, devDeploymentPipeline: QMDeploymentPipeline, releaseDeploymentPipelines: QMDeploymentPipeline[]) {
    const jenkinsDeploymentJobTemplates: JenkinsDeploymentJobTemplate[] = [];
    for (const releasePipeline of releaseDeploymentPipelines) {
        let lastDeploymentEnvironmentMetadata: JenkinsProjectMetadata = getDeploymentEnvironmentJenkinsMetadata(tenantName, projectName, devDeploymentPipeline, getHighestPreProdEnvironment(devDeploymentPipeline));
        for (const deploymentEnvironment of releasePipeline.environments) {
            const deploymentEnvironmentJenkinsMetadata = getDeploymentEnvironmentJenkinsMetadata(tenantName, projectName, releasePipeline, deploymentEnvironment);
            const sourceJenkinsfile = "jenkinsfile.deployment";
            const expectedJenkinsfile = `Jenkinsfile${getEnvironmentDeploymentJenkinsfileNamePostfix(releasePipeline, deploymentEnvironment)}`;
            const jobNamePostfix = getEnvironmentDeploymentJenkinsJobPostfix(releasePipeline, deploymentEnvironment);
            const jobTemplateFilename = getJenkinsMultiBranchDeploymentJobTemplate();
            jenkinsDeploymentJobTemplates.push(
                {
                    sourceJenkinsfile,
                    expectedJenkinsfile,
                    sourceEnvironment: lastDeploymentEnvironmentMetadata,
                    deploymentEnvironment: deploymentEnvironmentJenkinsMetadata,
                    jobNamePostfix,
                    jobTemplateFilename,
                },
            );
            lastDeploymentEnvironmentMetadata = deploymentEnvironmentJenkinsMetadata;
        }
    }
    return jenkinsDeploymentJobTemplates;
}
