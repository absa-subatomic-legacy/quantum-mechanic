import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {Attachment} from "@atomist/slack-messages";
import * as _ from "lodash";
import {createSortedMenuAttachment} from "../shared/GenericMenu";

export enum ApplicationType {

    DEPLOYABLE = "DEPLOYABLE",
    LIBRARY = "LIBRARY",
}

export function menuAttachmentForApplications(ctx: HandlerContext, applications: any[],
                                              command: HandleCommand, message: string = "Please select an application/library",
                                              applicationNameVariable: string = "applicationName"): Attachment {
    return createSortedMenuAttachment(
        applications.map(application => {
            return {
                value: application.name,
                text: application.name,
            };
        }),
        command,
        {
            text: message,
            fallback: message,
            selectionMessage: "Select Application/Library",
            resultVariableName: applicationNameVariable,
        },
    );
}

export function getBuildConfigName(projectName: string, packageName: string): string {
    return `${_.kebabCase(projectName).toLowerCase()}-${_.kebabCase(packageName).toLowerCase()}`;
}

export function bitbucketProjectKeyFromRepositoryRemoteUrl(remoteUrl: string) {
    const remoteSplit = remoteUrl.split("/");
    return remoteSplit[remoteSplit.length - 2];
}
