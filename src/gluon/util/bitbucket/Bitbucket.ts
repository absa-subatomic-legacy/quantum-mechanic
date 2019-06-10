import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {Attachment} from "@atomist/slack-messages";
import {createSortedMenuAttachment} from "../shared/GenericMenu";

export function menuAttachmentForBitbucketRepositories(ctx: HandlerContext, bitbucketRepositories: any[],
                                                       command: HandleCommand, message: string = "Please select a Bitbucket repository",
                                                       bitbucketProjectNameVariable: string = "bitbucketRepositorySlug",
                                                       thumbUrl = ""): Attachment {
    return createSortedMenuAttachment(
        bitbucketRepositories.map(bitbucketRepository => {
            return {
                value: bitbucketRepository.slug,
                text: bitbucketRepository.name,
            };
        }),
        command,
        {
            text: message,
            fallback: message,
            selectionMessage: "Select Bitbucket Repo",
            resultVariableName: bitbucketProjectNameVariable,
            thumbUrl,
        },
    );
}

export interface QMBitbucketProject {
    bitbucketProjectId: string;

    key: string;

    name: string;

    description: string;

    url: string;
}
