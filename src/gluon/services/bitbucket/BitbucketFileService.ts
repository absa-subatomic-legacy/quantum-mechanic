import {GitProject, logger} from "@atomist/automation-client";
import {cloneBitbucketProject} from "../../util/git/Git";
import {GitError} from "../../util/shared/Error";

export class BitbucketFileService {

    public async addFilesToBitbucketRepository(bitbucketProjectKey, bitbucketRepositorySlug, files: SourceControlledFileRequest[]) {
        const project: GitProject = await cloneBitbucketProject(bitbucketProjectKey, bitbucketRepositorySlug);

        let filesAdded: boolean = false;

        for (const file of files) {
            try {
                await project.findFile(file.filename);
            } catch (error) {
                logger.info(`${file.filename} doesnt exist. Adding it!`);
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
}

export interface SourceControlledFileRequest {
    filename: string;
    content: string;
    commitMessage: string;
}
