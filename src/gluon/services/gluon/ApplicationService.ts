import {logger} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {AwaitAxios} from "../../../http/AwaitAxios";
import {isSuccessCode} from "../../../http/Http";
import {CommandIntent} from "../../commands/CommandIntent";
import {LinkExistingApplication} from "../../commands/packages/LinkExistingApplication";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {QMColours} from "../../util/QMColour";
import {QMError} from "../../util/shared/Error";
import {
    QMApplication,
    QMNewApplication,
} from "../../util/transform/types/gluon/Application";

export class ApplicationService {

    constructor(public axiosInstance = new AwaitAxios()) {
    }

    public async gluonApplicationsLinkedToGluonProject(gluonProjectName: string, requestActionOnFailure: boolean = true): Promise<any | QMApplication[]> {
        logger.debug(`Trying to get gluon applications associated to projectName. gluonProjectName: ${gluonProjectName} `);

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/applications?projectName=${gluonProjectName}`);

        if (!isSuccessCode(result.status)) {
            throw new QMError(`Failed to get applications linked to project ${gluonProjectName}`);
        }

        let returnValue = [];

        if (!_.isEmpty(result.data._embedded)) {
            returnValue = result.data._embedded.applicationResources;
        } else if (requestActionOnFailure) {
            const slackMessage: SlackMessage = {
                text: "Unfortunately there are no applications linked to this project.",
                attachments: [{
                    text: "Would you like to link an existing application?",
                    fallback: "Would you like to link an existing application?",
                    footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.LinkExistingApplication)}`,
                    actions: [
                        buttonForCommand(
                            {
                                text: "Link existing application",
                            },
                            new LinkExistingApplication()),
                    ],
                }],
            };

            throw new QMError(`No applications linked to project ${gluonProjectName}.`, slackMessage);
        }

        return returnValue;

    }

    public async gluonApplicationForNameAndProjectName(applicationName: string,
                                                       projectName: string,
                                                       requestActionOnFailure: boolean = true): Promise<any> {
        logger.debug(`Trying to get gluon applications associated to name and project. applicationName: ${applicationName}; projectName: ${projectName}`);

        const result = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/applications?name=${applicationName}&projectName=${projectName}`);

        if (!isSuccessCode(result.status) || _.isEmpty(result.data._embedded)) {
            const errorMessage = `Application with name ${applicationName} in project ${projectName} does not exist`;
            if (requestActionOnFailure) {
                const slackMessage: SlackMessage = {
                    text: "This command requires an existing application",
                    attachments: [{
                        text: `
Unfortunately Subatomic does not manage this application.
Consider linking an existing application called ${applicationName}. Click the button below to do that now.
                            `,
                        fallback: "Application not managed by Subatomic",
                        footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.LinkExistingApplication)}`,
                        color: QMColours.stdMuddyYellow.hex,
                        mrkdwn_in: ["text"],
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Link existing application",
                                },
                                new LinkExistingApplication(), {
                                    name: applicationName,
                                }),
                        ],
                    }],
                };

                throw new QMError(errorMessage, slackMessage);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.applicationResources[0];
    }

    public gluonApplicationsLinkedToGluonProjectId(gluonProjectId: string): Promise<any[]> {
        logger.debug(`Trying to get gluon applications associated to project Id. gluonProjectId: ${gluonProjectId} `);
        return this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/applications?projectId=${gluonProjectId}`)
            .then(applications => {
                if (!_.isEmpty(applications.data._embedded)) {
                    return Promise.resolve(applications.data._embedded.applicationResources);
                }
                return [];
            });
    }

    public async createGluonApplication(applicationDetails: QMNewApplication): Promise<any> {
        logger.debug(`Trying to create application.`);
        return await this.axiosInstance.post(`${QMConfig.subatomic.gluon.baseUrl}/applications`, applicationDetails);
    }

    public async setApplicationJenkinsFolder(applicationId: string, jenkinsFolder: string): Promise<any> {
        return await this.axiosInstance.put(`${QMConfig.subatomic.gluon.baseUrl}/applications/${applicationId}`, {
            jenkinsFolder,
        });
    }
}
