import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import {CommandIntent} from "../../commands/CommandIntent";
import {CreateProject} from "../../commands/project/CreateProject";
import {AddConfigServer} from "../../commands/team/AddConfigServer";
import {DocumentationUrlBuilder} from "../documentation/DocumentationUrlBuilder";

export class DevOpsMessages {
    public jenkinsSuccessfullyProvisioned(jenkinsHost: string, teamName: string): SlackMessage {
        return {
            text: `Your Jenkins instance has been successfully provisioned in the DevOps environment: ${url(`https://${jenkinsHost}`)}`,
            attachments: [{
                fallback: `Create a project`,
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.CreateProject)}`,
                text: `
If you haven't already, you might want to create a Project for your team to work on.`,
                mrkdwn_in: ["text"],
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Create project"},
                        new CreateProject(),
                        {teamName}),
                ],
            }, {
                fallback: `Add a Subatomic Config Server`,
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.AddConfigServer)}`,
                text: `
If your applications will require a Spring Cloud Config Server, you can add a Subatomic Config Server to your DevOps project now`,
                mrkdwn_in: ["text"],
                thumb_url: "https://docs.spring.io/spring-cloud-dataflow/docs/current-SNAPSHOT/reference/html/images/logo.png",
                actions: [
                    buttonForCommand(
                        {text: "Add Config Server"},
                        new AddConfigServer(),
                        {gluonTeamName: teamName}),
                ],
            }],
        };
    }
}
