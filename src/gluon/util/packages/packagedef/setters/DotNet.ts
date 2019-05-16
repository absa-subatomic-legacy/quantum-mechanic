import {GitProject, logger} from "@atomist/automation-client";
import {toPromise} from "@atomist/automation-client/lib/project/util/projectUtils";
import {BitbucketFileService} from "../../../../services/bitbucket/BitbucketFileService";
import {ApplicationService} from "../../../../services/gluon/ApplicationService";
import {ProjectService} from "../../../../services/gluon/ProjectService";

export async function setStartupProject(state) {
    const applicationService = new ApplicationService();
    const projectService = new ProjectService();
    const application = await applicationService.gluonApplicationForNameAndProjectName(state.applicationName, state.projectName, false);
    const project = await projectService.gluonProjectFromProjectName(state.projectName);
    const gitRepo: GitProject = await new BitbucketFileService().cloneBitbucketRepository(project.bitbucketProject.key, application.bitbucketRepository.slug);
    return await findAvailableDotnetProjects(gitRepo);
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

async function findAvailableDotnetProjects(project: GitProject) {
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
