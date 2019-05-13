import {buttonForCommand} from "@atomist/automation-client";
import {Attachment, SlackMessage} from "@atomist/slack-messages";
import {
    OpenShiftConfig,
    OpenshiftProjectEnvironment,
} from "../../../../config/OpenShiftConfig";
import {DocumentationUrlBuilder} from "../../../messages/documentation/DocumentationUrlBuilder";
import {QMColours} from "../../../util/QMColour";
import {CommandIntent} from "../../CommandIntent";
import {DefineNewProjectEnvironments} from "../DefineNewProjectEnvironments";

export class DefinePipelineMessages {

    public selectPipelineDefinition(teamName: string, projectName: string, openShiftNonProd: OpenShiftConfig): SlackMessage {
        const text: string = `Your project does not have any deployment pipelines defined. The deployment pipeline determines what OpenShift environments are created for your project. Please select a deployment pipeline to use for this Project.`;

        return {
            text,
            attachments: [
                this.buildDefaultPipelineAttachment(teamName, projectName, openShiftNonProd.defaultEnvironments, [openShiftNonProd.defaultEnvironments[0], openShiftNonProd.defaultEnvironments[openShiftNonProd.defaultEnvironments.length - 1]]),

            ],
        };
    }

    private buildDefaultPipelineAttachment(teamName: string, projectName: string, defaultPipelineEnvironments: OpenshiftProjectEnvironment[], minimalPipelineEnvironments: OpenshiftProjectEnvironment[]): Attachment {
        const text: string = `*Default Pipeline:* ${this.buildEnvironmentNamesString(defaultPipelineEnvironments.map(environment => environment.description))}\n` +
            `*Minimal Pipeline:* ${this.buildEnvironmentNamesString(minimalPipelineEnvironments.map(environment => environment.description))}`;
        const newDefaultPipelinesCommand = this.createNewPipelinesCommand(teamName, projectName, defaultPipelineEnvironments.map(environment => environment.id));
        const newMinimalPipelinesCommand = this.createNewPipelinesCommand(teamName, projectName, minimalPipelineEnvironments.map(environment => environment.id));
        return {
            text,
            fallback: "Create default pipeline.",
            footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.RequestProjectEnvironments)}`,
            color: QMColours.stdGreenyMcAppleStroodle.hex,
            actions: [
                buttonForCommand(
                    {
                        text: "Default Pipeline",
                        style: "primary",
                    },
                    newDefaultPipelinesCommand),
                buttonForCommand(
                    {
                        text: "Minimal Pipeline",
                    },
                    newMinimalPipelinesCommand),
            ],
        };
    }

    private buildEnvironmentNamesString(environmentNames: string[]) {
        let text = ``;
        for (const environmentName of environmentNames) {
            text += `*${environmentName}* → `;
        }
        return text.substring(0, text.length - 3);
    }

    private createNewPipelinesCommand(teamName: string, projectName: string, environmentTags: string[]) {
        const newPipelinesCommand = new DefineNewProjectEnvironments();
        newPipelinesCommand.requestedEnvironments = environmentTags;
        newPipelinesCommand.teamName = teamName;
        newPipelinesCommand.projectName = projectName;
        return newPipelinesCommand;
    }

}
