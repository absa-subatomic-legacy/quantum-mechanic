import {
    HandleCommand,
    HandlerContext,
    logger,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {CreateApplication} from "../../commands/packages/CreateApplication";
import {QMError} from "../shared/Error";
import {createMenu} from "../shared/GenericMenu";
import {isSuccessCode} from "../shared/Http";

export enum ApplicationType {

    DEPLOYABLE = "DEPLOYABLE",
    LIBRARY = "LIBRARY",
}

export class ApplicationService {
    public async gluonApplicationsLinkedToGluonProject(gluonProjectName: string, requestActionOnFailure: boolean = true): Promise<any> {
        logger.debug(`Trying to get gluon applications associated to projectName. gluonProjectName: ${gluonProjectName} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/applications?projectName=${gluonProjectName}`);

        if (!isSuccessCode(result.status)) {
            throw new QMError(`Failed to get applications linked to project ${gluonProjectName}`);
        }

        if (requestActionOnFailure && result.data._embedded.applicationResources.isEmpty()) {
            const slackMessage: SlackMessage = {
                text: "Unfortunately there are no applications linked to this project.",
                attachments: [{
                    text: "Would you like to create a new application?",
                    fallback: "Would you like to create a new application?",
                    actions: [
                        buttonForCommand(
                            {
                                text: "Create application",
                            },
                            new CreateApplication()),
                    ],
                }],
            };

            throw new QMError(`No applications linked to project ${gluonProjectName}.`, slackMessage);
        }

        return result.data._embedded.applicationResources;

    }

    public gluonApplicationForNameAndProjectName(ctx: HandlerContext,
                                                 applicationName: string,
                                                 projectName: string,
                                                 message: string = "This command requires an existing application"): Promise<any> {
        logger.debug(`Trying to get gluon applications associated to name and project. applicationName: ${applicationName}; projectName: ${projectName}`);
        return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/applications?name=${applicationName}&projectName=${projectName}`)
            .then(applications => {
                if (!_.isEmpty(applications.data._embedded)) {
                    return Promise.resolve(applications.data._embedded.applicationResources[0]);
                } else {
                    const msg: SlackMessage = {
                        text: message,
                        attachments: [{
                            text: `
Unfortunately Subatomic does not manage this project.
Consider creating a new application called ${applicationName}. Click the button below to do that now.
                            `,
                            fallback: "Application not managed by Subatomic",
                            footer: `For more information, please read the ${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#create-bitbucket-project`,
                                "documentation")}`,
                            color: "#ffcc00",
                            mrkdwn_in: ["text"],
                            actions: [
                                buttonForCommand(
                                    {
                                        text: "Create application",
                                    },
                                    new CreateApplication(), {
                                        name: applicationName,
                                    }),
                            ],
                        }],
                    };

                    return ctx.messageClient.respond(msg)
                        .then(() => Promise.reject(
                            `Application with name ${applicationName} does not exist`));
                }
            });
    }

    public gluonApplicationsLinkedToGluonProjectId(gluonProjectId: string): Promise<any[]> {
        logger.debug(`Trying to get gluon applications associated to project Id. gluonProjectId: ${gluonProjectId} `);
        return axios.get(`${QMConfig.subatomic.gluon.baseUrl}/applications?projectId=${gluonProjectId}`)
            .then(applications => {
                if (!_.isEmpty(applications.data._embedded)) {
                    return Promise.resolve(applications.data._embedded.applicationResources);
                }
                return [];
            });
    }

    public async createGluonApplication(applicationDetails: any): Promise<any> {
        return await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/applications`, applicationDetails);
    }
}

export function menuForApplications(ctx: HandlerContext, applications: any[],
                                    command: HandleCommand, message: string = "Please select an application/library",
                                    applicationNameVariable: string = "applicationName"): Promise<any> {
    return createMenu(ctx,
        applications.map(application => {
            return {
                value: application.name,
                text: application.name,
            };
        }),
        command,
        message,
        "Select Application/Library",
        applicationNameVariable,
    );
}
