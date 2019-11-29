import {
    BitBucketServerRepoRef,
    GitCommandGitProject,
    GitProject,
    logger,
} from "@atomist/automation-client";
import {execPromise} from "@atomist/automation-client/lib/util/child_process";
import * as path from "path";
import {QMConfig} from "../../../config/QMConfig";
import {GitError} from "../../util/shared/Error";

export class BitbucketFileService {

    public async addFilesToBitbucketRepository(bitbucketProjectKey, bitbucketRepositorySlug, files: SourceControlledFileRequest[]) {
        const project: GitProject = await this.cloneBitbucketRepository(bitbucketProjectKey, bitbucketRepositorySlug);

        let filesAdded: boolean = false;

        for (const file of files) {
            try {
                await project.findFile(file.filename);
            } catch (error) {
                logger.info(`${file.filename} doesnt exist. Adding it!`);
                const directory = path.dirname(file.filename);
                if (directory !== ".") {
                    await project.addDirectory(directory);
                }
                await project.addFile(file.filename, file.content);
                await project.commit(file.commitMessage);
                filesAdded = true;
            }
        }

        try {
            if (filesAdded) {
                await project.push();
            }
        } catch (error) {
            logger.debug(`Error pushing requested files to repository`);
            throw new GitError(error.message);
        }

    }

    public async cloneBitbucketRepository(bitbucketProjectKey, bitbucketRepositorySlug): Promise<GitProject> {
        const username = QMConfig.subatomic.bitbucket.auth.username;
        const password = QMConfig.subatomic.bitbucket.auth.password;
        let project: GitProject;
        try {
            project = await GitCommandGitProject.cloned({
                    username,
                    password,
                },
                new BitBucketServerRepoRef(
                    QMConfig.subatomic.bitbucket.baseUrl,
                    bitbucketProjectKey,
                    bitbucketRepositorySlug));
        } catch (e) {
            logger.error(`Failed to clone git repository: ` + e.message);
            throw new GitError(e.message, "Failed to clone git repository. Please make sure that the repository exists, and that Subatomic has access to it.");
        }
        try {
            project.branch = (await execPromise("git", ["rev-parse", "--abbrev-ref", "HEAD"], {cwd: project.baseDir})).stdout.trim();
            logger.info(`Set current branch to "${project.branch}"`);
        } catch (e) {
            logger.error(`Failed to set branch to default branch. Assuming master branch. Error: ${e.message}`);
        }

        await project.setUserConfig(
            QMConfig.subatomic.bitbucket.auth.username,
            QMConfig.subatomic.bitbucket.auth.email,
        );
        return project;
    }
}

export interface SourceControlledFileRequest {
    filename: string;
    content: string;
    commitMessage: string;
}
