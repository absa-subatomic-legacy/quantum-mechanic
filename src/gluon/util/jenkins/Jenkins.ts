import _ = require("lodash");

const JENKINSFILE_FOLDER = "resources/templates/jenkins/jenkinsfile-repo/";
const JENKINSFILE_EXTENSION = ".groovy";

export function getDefaultProdJenkinsFileName() {
    return "jenkinsfile.prod";
}

export function getPathFromJenkinsfileName(jenkinsfileName: string): string {
    return JENKINSFILE_FOLDER + jenkinsfileName + JENKINSFILE_EXTENSION;
}

function getKebabCaseEnvironmentPostfixWithSeperator(pipelineTag: string, environmentPostfix: string, seperatorCharactor: string) {
    let postfix = `${seperatorCharactor}${_.kebabCase(pipelineTag)}${seperatorCharactor}${_.kebabCase(environmentPostfix)}`;
    if (_.isEmpty(pipelineTag)) {
        postfix = `${seperatorCharactor}${_.kebabCase(environmentPostfix)}`;
    }
    return postfix;
}

export function getEnvironmentDeploymentJenkinsfilePostfix(pipelineTag: string, environmentPostfix: string) {
    return getKebabCaseEnvironmentPostfixWithSeperator(pipelineTag, environmentPostfix, ".");
}

export function getEnvironmentDeploymentJenkinsJobPostfix(pipelineTag: string, environmentPostfix: string) {
    return getKebabCaseEnvironmentPostfixWithSeperator(pipelineTag, environmentPostfix, "-");
}

export function getApplicationJenkinsJobDisplayName(applicationName: string, jobPostfix: string) {
    return `${applicationName} ${_.startCase(jobPostfix)}`;
}
