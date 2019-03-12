import {JenkinsProjectMetadata} from "../project/Project";

export interface JenkinsJobTemplate {
    sourceJenkinsfile?: string;
    jobTemplateFilename: string;
    expectedJenkinsfile: string;
    jobNamePostfix: string;
}

export const NonProdDefaultJenkinsJobTemplate: JenkinsJobTemplate = {
    jobTemplateFilename: getJenkinsMultiBranchProjectJobTemplateFile(),
    expectedJenkinsfile: "Jenkinsfile",
    jobNamePostfix: "",
};

export const ProdDefaultJenkinsJobTemplate: JenkinsJobTemplate = {
    jobTemplateFilename: "jenkins-prod-project.xml",
    expectedJenkinsfile: "Jenkinsfile.prod",
    jobNamePostfix: "-prod",
};

export const EmptyJenkinsJobTemplate: JenkinsJobTemplate = {
    jobTemplateFilename: "",
    expectedJenkinsfile: "",
    jobNamePostfix: "",
};

export interface JenkinsDeploymentJobTemplate extends JenkinsJobTemplate {
    sourceEnvironment: JenkinsProjectMetadata;
    deploymentEnvironments: JenkinsProjectMetadata[];
}

export function getJenkinsProdJobTemplateFile() {
    return "jenkins-prod-project.xml";
}

export function getJenkinsMultiBranchProjectJobTemplateFile() {
    return "jenkins-multi-branch-project.xml";
}

export function getJenkinsMultiBranchDeploymentJobTemplateFile() {
    return "jenkins-multi-branch-deployment-project.xml";
}
