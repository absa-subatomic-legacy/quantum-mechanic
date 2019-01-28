import {logger} from "@atomist/automation-client";
import {exec} from "child_process";
import * as fs from "fs";
import {BitbucketService} from "../../../../services/bitbucket/BitbucketService";
import {ApplicationService} from "../../../../services/gluon/ApplicationService";
import {ProjectService} from "../../../../services/gluon/ProjectService";

export async function setStartupProject(state) {
    const bitbucketService = new BitbucketService();
    const applicationService = new ApplicationService();
    const projectService = new ProjectService();
    const application = await applicationService.gluonApplicationForNameAndProjectName(state.applicationName, state.projectName, false);
    const project = await projectService.gluonProjectFromProjectName(state.projectName);
    const repoResult = await bitbucketService.bitbucketRepositoryForSlug(project.bitbucketProject.key, application.bitbucketRepository.slug);
    const projectArray = new Array();
    const util = require("util");
    const execProm = util.promisify(exec);

    execProm("rm -rf ../tmpGit");
    execProm("mkdir ../tmpGit");

    await execProm(`git clone --depth 1 ${repoResult.data.links.clone[1].href} ../tmpGit/`).then(async result => {
        if (result.error) {
            logger.warn(`Error cloning Bitbucket repo: ${result.error}`);
        }
        return await fs.readdirSync("../tmpGit").map(async file => {
            try {
                const fileStat = fs.statSync(file);
                if (fileStat.isDirectory()) {
                    return traverseDirectories(file, "../tmpGit", projectArray);
                }
            } catch (error) {
                console.log(error);
            }
        });
    }).catch(error => {
        console.log(error);
    });

    execProm("rm -rf ../tmpGit");
    return projectArray;
}

function traverseDirectories(directoryName: string, path: string, projectArray: Array<{ value: string, text: string }>) {
    const filePath = `${path}/${directoryName}`;
    try {
        if (!filePath.endsWith(".git")) {
            try {
                fs.readdirSync(filePath).map(async file => {
                    const fileUrl = `${filePath}/${file}`;
                    try {
                        const fileStat = fs.statSync(fileUrl);
                        if (file.endsWith(".sln")) {
                            return getProjectPathsFromfile(fileUrl, projectArray);
                        } else if (fileStat.isDirectory() && checkDirectoryDepth(fileUrl)) {
                            return traverseDirectories(file, filePath, projectArray);
                        }
                    } catch (error) {
                        console.log(error);
                    }
                });
            } catch (error) {
                console.log(error);
            }
        }
    } catch (error) {
        console.log(error);
    }
}

function getProjectPathsFromfile(solutionFile: string, projectArray: Array<{ value: string, text: string }>) {
    try {
        const data = fs.readFileSync(solutionFile, "utf8");
        const projectPaths = data.split("\", \"");
        for (const projectPath of projectPaths) {
            if (projectPath.endsWith("proj")) {
                projectArray.push(
                    {
                        value: projectPath,
                        text: projectPath,
                    },
                );
            }
        }
    } catch (error) {
        console.log(error);
    }
}

function checkDirectoryDepth(filePath: string): boolean {
    const pathPartition = filePath.split("/");
    if (pathPartition.length > 6) {
        return false;
    }
    return true;
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
