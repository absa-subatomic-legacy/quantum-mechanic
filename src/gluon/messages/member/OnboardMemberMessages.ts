import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {CreateTeam} from "../../commands/team/CreateTeam";
import {JoinTeam} from "../../commands/team/JoinTeam";
import {DocumentationUrlBuilder} from "../documentation/DocumentationUrlBuilder";

export class OnboardMemberMessages {

    public presentTeamCreationAndApplicationOptions(firstName: string, secondarySlackChannels: string[]): SlackMessage {

        const text: string = `🚀 Welcome to the Subatomic environment *${firstName}*!\n\n` +
            `${secondarySlackChannels.length > 0 ? `You have been added to the Subatomic community channel/s:\n *${secondarySlackChannels.join("*\n*")}*\n\n` : "\n\n"}` +
            `Next steps are to either join an existing team or create a new one.`;

        return {
            text,
            attachments: [{
                fallback: "Welcome to the Subatomic environment",
                footer: `For more information, please read the ${DocumentationUrlBuilder.userGuide()}.`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {
                            text: "Apply to join a team",
                            style: "primary",
                        },
                        new JoinTeam()),
                    buttonForCommand(
                        {text: "Create a new team"},
                        new CreateTeam()),
                ],
            }],
        };
    }

}
