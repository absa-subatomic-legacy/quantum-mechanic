import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {Attachment} from "@atomist/slack-messages";
import {createMenuAttachment} from "../shared/GenericMenu";

export function menuAttachmentForBitbucketRepositories(ctx: HandlerContext, bitbucketRepositories: any[],
                                                       command: HandleCommand, message: string = "Please select a Bitbucket repository",
                                                       bitbucketProjectNameVariable: string = "bitbucketRepositorySlug",
                                                       thumbUrl = ""): Attachment {
    return createMenuAttachment(
        bitbucketRepositories.map(bitbucketRepository => {
            return {
                value: bitbucketRepository.slug,
                text: bitbucketRepository.name,
            };
        }),
        command,
        message,
        message,
        "Select Bitbucket Repo",
        bitbucketProjectNameVariable,
        thumbUrl,
    );
}

export interface QMBitbucketProject {
    bitbucketProjectId: string;

    key: string;

    name: string;

    description: string;

    url: string;
}
