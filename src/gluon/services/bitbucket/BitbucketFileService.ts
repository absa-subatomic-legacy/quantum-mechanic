import {
    BitBucketServerRepoRef,
    GitCommandGitProject,
    GitProject,
    logger,
} from "@atomist/automation-client";
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
                await project.addFile(file.filename, file.content);
                filesAdded = true;
            }
        }

        await project.commit("Files added by Subatomic.");

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
        return project;
    }
}

export interface SourceControlledFileRequest {
    filename: string;
    content: string;
    commitMessage: string;
}
