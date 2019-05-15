import {
    BitBucketServerRepoRef,
    GitCommandGitProject,
    GitProject,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";

export async function cloneBitbucketProject(bitbucketProjectKey, bitbucketRepositorySlug): Promise<GitProject> {
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
