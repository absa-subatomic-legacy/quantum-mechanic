import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {CommandIntent} from "../../commands/CommandIntent";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {LinkExistingTeamSlackChannel} from "../../commands/team/LinkExistingTeamSlackChannel";
import {NewTeamSlackChannel} from "../../commands/team/NewSlackChannel";
import {QMColours} from "../../util/QMColour";
import {DocumentationUrlBuilder} from "../documentation/DocumentationUrlBuilder";

export class TeamSlackChannelMessages {
    public requestNonExistentTeamsCreation(gluonTeamName: string): SlackMessage {
        return {
            text: `There was an error creating your *${gluonTeamName}* team channel`,
            attachments: [{
                text: `
Unfortunately this team does not seem to exist on Subatomic.
To create a team channel you must first create a team. Click the button below to do that now.
                                                  `,
                fallback: "Team does not exist on Subatomic",
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.CreateTeam)}`,
                color: QMColours.stdReddyMcRedFace.hex,
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

    public createNewOrUseExistingSlackChannel(teamChannel: string, teamName: string): SlackMessage {
        const text: string = `\
Would you like to create a new team channel called *${teamChannel}* or \
if you have an existing channel you'd like to use for team wide messages, \
rather use that instead?\
        `;
        return {
            text,
            attachments: [{
                fallback: `Do you want to create a new team channel (${teamChannel}) or link an existing one?`,
                footer: `For more information, please read the ${DocumentationUrlBuilder.userGuide()}`,
                actions: [
                    buttonForCommand(
                        {text: `Create channel ${teamChannel}`},
                        new NewTeamSlackChannel(),
                        {
                            teamName,
                            newTeamChannel: teamChannel,
                        }),
                    buttonForCommand(
                        {text: "Use an existing channel"},
                        new LinkExistingTeamSlackChannel(),
                        {
                            teamName,
                        }),
                ],
            }],
        };
    }
}
