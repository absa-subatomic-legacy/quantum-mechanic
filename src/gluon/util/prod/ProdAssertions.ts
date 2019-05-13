import {SlackMessage} from "@atomist/slack-messages";
import {ProdRequestMessages} from "../../messages/prod/ProdRequestMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {QMProject} from "../project/Project";
import {QMError} from "../shared/Error";

export async function assertProjectProductionIsApproved(projectName: string, deploymentPipelineId: string, failureMessage: string, gluonService: GluonService = new GluonService()) {
    const project: QMProject = await gluonService.projects.gluonProjectFromProjectName(projectName);
    try {
        await gluonService.prod.project.assertProjectProdIsApproved(project.projectId, deploymentPipelineId);
    } catch (error) {
        if (error instanceof QMError) {
            const prodRequestMessages: ProdRequestMessages = new ProdRequestMessages();

            const slackMessage: SlackMessage = {
                text: failureMessage,
                attachments: [
                    prodRequestMessages.getProjectProdRequestAttachment(projectName),
                ],
            };

            throw new QMError(failureMessage, slackMessage, undefined, false);
        }
        throw error;
    }
}

export async function assertGenericProdCanBeRequested(projectName: string, deploymentPipelineId: string, gluonService: GluonService = new GluonService()) {
    const failureMessage: string = `Generic resource production promotion is not available since the project *${projectName}* selected pipeline has not be approved for production.`;
    await assertProjectProductionIsApproved(projectName, deploymentPipelineId, failureMessage, gluonService);
}

export async function assertApplicationProdCanBeRequested(projectName: string, deploymentPipelineId: string, gluonService: GluonService = new GluonService()) {
    const failureMessage: string = `Application production promotion is not available since the project *${projectName}* selected pipeline has not be approved for production.`;
    await assertProjectProductionIsApproved(projectName, deploymentPipelineId, failureMessage, gluonService);
}

export async function assertApplicationJenkinsProdCanBeRequested(applicationName: string, projectName: string, deploymentPipelineId: string, gluonService: GluonService = new GluonService()) {
    const failureMessage: string = `Application Jenkins production job creation for application *${applicationName}* is not available since the project *${projectName}* selected pipeline has not be approved for production.`;
    await assertProjectProductionIsApproved(projectName, deploymentPipelineId, failureMessage, gluonService);
}
