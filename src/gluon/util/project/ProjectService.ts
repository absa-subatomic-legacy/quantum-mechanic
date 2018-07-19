import {
    HandleCommand,
    HandlerContext,
    logger,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import axios from "axios";
import {QMConfig} from "../../../config/QMConfig";
import {CreateProject} from "../../commands/project/CreateProject";
import {QMError} from "../shared/Error";
import {createMenu} from "../shared/GenericMenu";
import {isSuccessCode} from "../shared/Http";

export class ProjectService {
    public async gluonProjectFromProjectName(projectName: string,
                                             requestActionOnFailure: boolean = true): Promise<any> {
        logger.debug(`Trying to get gluon project by projectName. projectName: ${projectName} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/projects?name=${projectName}`);

        if (!isSuccessCode(result.status)) {
            const errorMessage = `Project with name ${projectName} does not exist`;
            if (requestActionOnFailure) {
                const slackMessage: SlackMessage = {
                    text: "This command requires an existing project",
                    attachments: [{
                        text: `
Unfortunately Subatomic does not manage this project.
Consider creating a new project called ${projectName}. Click the button below to do that now.
                            `,
                        fallback: "Project not managed by Subatomic",
                        footer: `For more information, please read the ${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#create-project`,
                            "documentation")}`,
                        color: "#ffcc00",
                        mrkdwn_in: ["text"],
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Create project",
                                },
                                new CreateProject(), {
                                    name: projectName,
                                }),
                        ],
                    }],
                };

                throw new QMError(errorMessage, slackMessage);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.projectResources[0];
    }

    public async gluonProjectsWhichBelongToGluonTeam(teamName: string, promptToCreateIfNoProjects = true): Promise<any[]> {
        logger.debug(`Trying to get gluon projects associated to team. teamName: ${teamName} `);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/projects?teamName=${teamName}`);

        if (!isSuccessCode(result.status)) {
            const errorMessage = `No projects associated to team ${teamName}`;
            if (promptToCreateIfNoProjects) {
                const slackMessage: SlackMessage = {
                    text: "Unfortunately there are no projects linked to any of your teams with that name.",
                    attachments: [{
                        text: "Would you like to create a new project?",
                        fallback: "Would you like to create a new project?",
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Create project",
                                },
                                new CreateProject()),
                        ],
                    }],
                };
                throw new QMError(errorMessage, slackMessage);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.projectResources;
    }

    public async gluonProjectList(promptToCreateIfNoProjects: boolean = true): Promise<any[]> {

        logger.debug(`Trying to get all gluon projects.`);

        const result = await axios.get(`${QMConfig.subatomic.gluon.baseUrl}/projects`);

        if (!isSuccessCode(result.status)) {
            const errorMessage = `No projects exist.`;
            if (promptToCreateIfNoProjects) {
                const slackMessage: SlackMessage = {
                    text: "Unfortunately there are no projects created yet.",
                    attachments: [{
                        text: "Would you like to create a new project?",
                        fallback: "Would you like to create a new project?",
                        actions: [
                            buttonForCommand(
                                {
                                    text: "Create project",
                                },
                                new CreateProject()),
                        ],
                    }],
                };
                throw new QMError(errorMessage, slackMessage);
            } else {
                throw new QMError(errorMessage);
            }
        }

        return result.data._embedded.projectResources;
    }

    public async createGluonProject(projectDetails: any): Promise<any> {
        return await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/projects`,
            projectDetails);
    }

    public async confirmBitbucketProjectCreated(projectId: string, bitbucketConfirmationDetails: any): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${projectId}`,
            bitbucketConfirmationDetails);
    }

    public async requestProjectEnvironment(projectId: string, memberId: string): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${projectId}`,
            {
                projectEnvironment: {
                    requestedBy: memberId,
                },
            });
    }

    public async associateTeamToProject(projectId: string, associationDetails: any): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${projectId}`, associationDetails);
    }

    public async updateProjectWithBitbucketDetails(projectId: string, bitbucketDetails: any): Promise<any> {
        return await axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${projectId}`,
            bitbucketDetails);
    }
}

export function menuForProjects(ctx: HandlerContext, projects: any[],
                                command: HandleCommand, message: string = "Please select a project",
                                projectNameVariable: string = "projectName"): Promise<any> {
    return createMenu(ctx,
        projects.map(project => {
            return {
                value: project.name,
                text: project.name,
            };
        }),
        command,
        message,
        "Select Project",
        projectNameVariable,
    );
}
