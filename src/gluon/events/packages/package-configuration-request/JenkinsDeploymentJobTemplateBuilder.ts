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

export function buildJenkinsProdDeploymentJobTemplates(tenantName: string, projectName: string, openShiftProdEnvironmentDefintions: OpenShiftConfig[], releaseDeploymentPipeline: QMDeploymentPipeline) {
    const jenkinsDeploymentJobTemplates: JenkinsDeploymentJobTemplate[] = [];
    const prepodEnvironment: JenkinsProjectMetadata = getDeploymentEnvironmentJenkinsMetadata(tenantName, projectName, releaseDeploymentPipeline, getHighestPreProdEnvironment(releaseDeploymentPipeline));

    const prodPostfix = "prod";
    const sourceJenkinsfile = getDefaultProdJenkinsFileName();
    const expectedJenkinsfile = `Jenkinsfile${getEnvironmentDeploymentJenkinsfilePostfix(releaseDeploymentPipeline.tag, prodPostfix)}`;
    const jobNamePostfix = getEnvironmentDeploymentJenkinsJobPostfix(releaseDeploymentPipeline.tag, prodPostfix);
    const jobTemplateFilename = getJenkinsProdJobTemplateFile();
    const deploymentEnvironments = [];
    for (const prodEnvironment of openShiftProdEnvironmentDefintions) {
        deploymentEnvironments.push(
            getDeploymentEnvironmentJenkinsMetadata(
                tenantName,
                projectName,
                releaseDeploymentPipeline,
                {
                    displayName: prodEnvironment.name,
                    postfix: _.kebabCase(prodEnvironment.name),
                },
            ),
        );
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
