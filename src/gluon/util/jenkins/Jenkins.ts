import _ = require("lodash");
import {
    QMDeploymentEnvironment,
    QMDeploymentPipeline,
} from "../project/Project";

const JENKINSFILE_FOLDER = "resources/templates/jenkins/jenkinsfile-repo/";
const JENKINSFILE_EXTENSION = ".groovy";

export function getDefaultProdJenkinsFileName() {
    return "jenkinsfile.prod";
}

export function getPathFromJenkinsfileName(jenkinsfileName: string): string {
    return JENKINSFILE_FOLDER + jenkinsfileName + JENKINSFILE_EXTENSION;
}

function getKebabCaseEnvironmentPostfixWithSeperator(pipeline: QMDeploymentPipeline, environment: QMDeploymentEnvironment, seperatorCharactor: string) {
    let postfix = `${seperatorCharactor}${_.kebabCase(pipeline.tag)}${seperatorCharactor}${_.kebabCase(environment.postfix)}`;
    if (_.isEmpty(pipeline.tag)) {
        postfix = `${seperatorCharactor}${_.kebabCase(environment.postfix)}`;
    }
    return postfix;
}

export function getEnvironmentDeploymentJenkinsfileNamePostfix(pipeline: QMDeploymentPipeline, environment: QMDeploymentEnvironment) {
    return getKebabCaseEnvironmentPostfixWithSeperator(pipeline, environment, ".");
}

export function getEnvironmentDeploymentJenkinsJobPostfix(pipeline: QMDeploymentPipeline, environment: QMDeploymentEnvironment) {
    return getKebabCaseEnvironmentPostfixWithSeperator(pipeline, environment, "-");
}

export function getApplicationJenkinsJobDisplayName(applicationName: string, jobPostfix: string) {
    return `${applicationName} ${_.camelCase(jobPostfix)}`;
}
