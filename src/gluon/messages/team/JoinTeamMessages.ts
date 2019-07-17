import {
    buttonForCommand,
    menuForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {CommandIntent} from "../../commands/CommandIntent";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {DocumentationUrlBuilder} from "../documentation/DocumentationUrlBuilder";

export class JoinTeamMessages {
    public presentMenuForTeamSelection(teams): SlackMessage {
        return {
            text: "Please select the team you would like to join",
            attachments: [{
                fallback: "Some buttons",
                actions: [
                    menuForCommand({
                            text: "Select Team", options:
                                teams.map(team => {
                                    return {
                                        value: team.teamId,
                                        text: team.name,
                                    };
                                }),
                        },
                        "CreateMembershipRequestToTeam",
                        "teamId",
                    ),
                ],
            }],
        };
    }

    public alertUserThatNoTeamsExist(): SlackMessage {
        return {
            text: `❗Unfortunately no teams have been created.`,
            attachments: [{
                fallback: "❗Unfortunately no teams have been created.",
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.CreateTeam)}`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Create a new team"},
                        new CreateTeam()),
                ],
            }],
        };
    }
}
