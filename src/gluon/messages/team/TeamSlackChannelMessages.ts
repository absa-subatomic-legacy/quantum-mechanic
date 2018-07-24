import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {CreateTeam} from "../../commands/team/CreateTeam";

export class TeamSlackChannelMessages {
    public requestNonExistentTeamsCreation(gluonTeamName: string, commandReferenceDocsExtension: string): SlackMessage {
        return {
            text: `There was an error creating your *${gluonTeamName}* team channel`,
            attachments: [{
                text: `
Unfortunately this team does not seem to exist on Subatomic.
To create a team channel you must first create a team. Click the button below to do that now.
                                                  `,
                fallback: "Team does not exist on Subatomic",
                footer: `For more information, please read the ${this.docs(commandReferenceDocsExtension)}`,
                color: "#D94649",
                mrkdwn_in: ["text"],
                actions: [
                    buttonForCommand(
                        {
                            text: "Create team",
                        },
                        new CreateTeam()),
                ],
            }],
        };
    }

    private docs(extension): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#${extension}`,
            "documentation")}`;
    }
}
