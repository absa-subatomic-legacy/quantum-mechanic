import {
    BitBucketServerRepoRef,
    GitCommandGitProject,
    GitProject,
    logger,
} from "@atomist/automation-client";
import {toPromise} from "@atomist/automation-client/lib/project/util/projectUtils";
import {QMConfig} from "../../../../../config/QMConfig";
import {ApplicationService} from "../../../../services/gluon/ApplicationService";
import {ProjectService} from "../../../../services/gluon/ProjectService";

export async function setStartupProject(state) {
    const applicationService = new ApplicationService();
    const projectService = new ProjectService();
    const application = await applicationService.gluonApplicationForNameAndProjectName(state.applicationName, state.projectName, false);
    const project = await projectService.gluonProjectFromProjectName(state.projectName);
    return await findAvailableDotnetProjects(project.bitbucketProject.key, application.bitbucketRepository.slug);
}

function getProjectPathsFromSolutionFileContent(solutionFileContent: string) {
    const projectArray: Array<{ value: string, text: string }> = [];
    try {
        const projectPaths = solutionFileContent.split("\", \"");
        for (const projectPath of projectPaths) {
            if (projectPath.endsWith("proj")) {
                projectArray.push(
                    {
                        value: projectPath.replace("\\", "/"),
                        text: projectPath.replace("\\", "/"),
                    },
                );
            }
        }
    } catch (error) {
        console.log(error);
    }
    return projectArray;
}

async function findAvailableDotnetProjects(bitbucketProjectKey, bitbucketRepositorySlug) {
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
    await project.setUserConfig(
        QMConfig.subatomic.bitbucket.auth.username,
        QMConfig.subatomic.bitbucket.auth.email,
    );

    const projectArray: Array<{ value: string, text: string }> = [];

    try {
        const files = await toPromise(project.streamFiles("*.sln"));
        for (const file of files) {
            projectArray.push(...getProjectPathsFromSolutionFileContent(file.getContentSync()));
        }
    } catch (error) {
        logger.info(`Could not find any solution files.`);
        // await project.addFile(file.filename, file.content);
        // await project.commit(file.commitMessage);
    }

    return projectArray;
}

export async function setRestoreSources(state) {

    if (state.restoreSources === "Jerry") {
        return [{}];
    }
    return [{
        value: state.restoreSources,
        text: state.restoreSources,
    }];
}
