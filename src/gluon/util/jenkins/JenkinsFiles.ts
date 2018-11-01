import {
    BitBucketServerRepoRef,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {GitCommandGitProject} from "@atomist/automation-client/project/git/GitCommandGitProject";
import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {QMConfig} from "../../../config/QMConfig";
import {QMTemplate} from "../../../template/QMTemplate";

const JENKINSFILE_EXISTS_FLAG = "JENKINS_FILE_EXISTS";

export async function addJenkinsFile(jenkinsfileName, bitbucketProjectKey, bitbucketRepositorySlug, destinationJenkinsfileName: string = "Jenkinsfile"): Promise<HandlerResult> {

    if (jenkinsfileName !== JENKINSFILE_EXISTS_FLAG) {
        const username = QMConfig.subatomic.bitbucket.auth.username;
        const password = QMConfig.subatomic.bitbucket.auth.password;
        const project: GitProject = await GitCommandGitProject.cloned({
                username,
                password,
            },
            new BitBucketServerRepoRef(
                QMConfig.subatomic.bitbucket.baseUrl,
                bitbucketProjectKey,
                bitbucketRepositorySlug));
        try {
            await project.findFile(destinationJenkinsfileName);
        } catch (error) {
            logger.info("Jenkinsfile doesnt exist. Adding it!");
            const jenkinsTemplate: QMTemplate = new QMTemplate(getPathFromJenkinsfileName(jenkinsfileName as string));
            await project.addFile(destinationJenkinsfileName,
                jenkinsTemplate.build({}));
        }

        const clean = await project.isClean();
        logger.debug(`Jenkinsfile has been added: ${clean.success}`);

        if (!clean.success) {
            await project.setUserConfig(
                QMConfig.subatomic.bitbucket.auth.username,
                QMConfig.subatomic.bitbucket.auth.email,
            );
            await project.commit(`Added Jenkinsfile`);
            await project.push();
        } else {
            logger.debug("Jenkinsfile already exists");
        }
    }

    return await success();
}

function getPathFromJenkinsfileName(jenkinsfileName: string, jenkinsFileFolder: string = "resources/templates/jenkins/jenkinsfile-repo/", jenkinsFileExtension: string = ".groovy"): string {
    return jenkinsFileFolder + jenkinsfileName + jenkinsFileExtension;
}

export interface JenkinsJobTemplate {
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
