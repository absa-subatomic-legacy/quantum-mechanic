import {QMDeploymentEnvironment} from "../project/Project";

export interface JenkinsJobTemplate {
    sourceJenkinsfile?: string;
    jobTemplateFilename: string;
    expectedJenkinsfile: string;
    jobNamePostfix: string;
}

export const NonProdDefaultJenkinsJobTemplate: JenkinsJobTemplate = {
    jobTemplateFilename: getJenkinsMultiBranchProjectJobTemplate(),
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
    sourceEnvironment: QMDeploymentEnvironment;
    deploymentEnvironment: QMDeploymentEnvironment;
}

export function getJenkinsMultiBranchProjectJobTemplate() {
    return "jenkins-multi-branch-project.xml";
}

export function getJenkinsMultiBranchDeploymentJobTemplate() {
    return "jenkins-multi-branch-deployment-project.xml";
}
