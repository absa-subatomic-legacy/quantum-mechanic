export interface JenkinsJobTemplate {
    sourceJenkinsFile?: string;
    templateFilename: string;
    expectedJenkinsfile: string;
    jobNamePostfix: string;
}

export const NonProdDefaultJenkinsJobTemplate: JenkinsJobTemplate = {
    templateFilename: "jenkins-multi-branch-project.xml",
    expectedJenkinsfile: "Jenkinsfile",
    jobNamePostfix: "",
};

export const ProdDefaultJenkinsJobTemplate: JenkinsJobTemplate = {
    templateFilename: "jenkins-prod-project.xml",
    expectedJenkinsfile: "Jenkinsfile.prod",
    jobNamePostfix: "-prod",
};

export const EmptyJenkinsJobTemplate: JenkinsJobTemplate = {
    templateFilename: "",
    expectedJenkinsfile: "",
    jobNamePostfix: "",
};
