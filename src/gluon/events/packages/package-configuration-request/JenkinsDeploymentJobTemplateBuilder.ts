import {
    getEnvironmentDeploymentJenkinsfilePostfix,
    getEnvironmentDeploymentJenkinsJobPostfix,
} from "../../../util/jenkins/Jenkins";
import {
    getJenkinsMultiBranchDeploymentJobTemplateFile,
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
            const expectedJenkinsfile = `Jenkinsfile${getEnvironmentDeploymentJenkinsfilePostfix(releasePipeline.tag, deploymentEnvironment.postfix)}`;
            const jobNamePostfix = getEnvironmentDeploymentJenkinsJobPostfix(releasePipeline.tag, deploymentEnvironment.postfix);
            const jobTemplateFilename = getJenkinsMultiBranchDeploymentJobTemplateFile();
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
