import {
    buttonForCommand,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {TeamService} from "../../services/gluon/TeamService";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";
import {ChannelMessageClient, handleQMError} from "../../util/shared/Error";

@EventHandler("Receive BroadcastMessageAllChannels events", `
subscription BroadcastMessageAllChannelsEvent {
 BroadcastMessageAllChannelsEvent {
    id
    text
    attachments {
        fallback
        color
        pretext
        author_name
        author_link
        author_icon
        title
        title_link
        text
        img_url
        thumb_url
        footer
        footer_icon
        actions {
            text
            style
            command
        }
  }
 }
}
`)

export class BroadcastMessageAllChannels extends BaseQMEvent implements HandleEvent<any> {

    constructor(private teamService = new TeamService()) {
        super();
    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {

        logger.info(`Ingested BroadcastMessageAllChannelsEvent, event.data = ${JSON.stringify(event.data)}`);

        const broadcastMessageAllChannelsData = event.data.BroadcastMessageAllChannelsEvent[0];

        try {
            const allteams = await this.teamService.getAllTeams();

            // map all slack channels and remove nulls
            let teamChannels: any[];
            teamChannels = allteams.data._embedded.teamResources.filter((x): x is string => x.slack !== null).map(i => {
                return i.slack.teamChannel;
            });

            // build actions and attachments - multiple attachments and multiple actions/buttons
            const myAttachments = [];
            broadcastMessageAllChannelsData.attachments.forEach(attachment => {

                const myActions = [];

                attachment.actions.forEach(action => {
                    myActions.push(buttonForCommand(
                        {
                            text: action.text,
                            style: action.style,
                        },
                        action.command,
                    ));
                });

                myAttachments.push({
                    fallback: attachment.fallback,
                    color: attachment.color,
                    pretext: attachment.pretext,
                    author_name: attachment.author_name,
                    author_link: attachment.author_link,
                    author_icon: attachment.author_icon,
                    title: attachment.title,
                    title_link: attachment.title_link,
                    text: attachment.text,
                    img_url: attachment.img_url,
                    thumb_url: attachment.thumb_url,
                    footer: attachment.footer,
                    footer_icon: attachment.footer_icon,
                    mrkdwn_in: ["text"],
                    actions: myActions,
                });
            });

            const msg = {
                text: broadcastMessageAllChannelsData.text,
                attachments: myAttachments,
            };

            // send the custom message to all team channels
            return await ctx.messageClient.addressChannels(
                msg,
                teamChannels);

        } catch (error) {
            this.failEvent();
            return await handleQMError(new ChannelMessageClient(ctx).addDestination(
                broadcastMessageAllChannelsData.team.slackIdentity.teamChannel),
                error);
        }
    }
}
