import {
    Destination, MessageClient, MessageOptions,
    SlackMessageClient,
} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage} from "@atomist/slack-messages";
import {logger} from "@atomist/automation-client";

export class TestMessageClient implements MessageClient, SlackMessageClient {
    public textMsg: any; // it can store what we care to verify
    public attachments: any;

    public addressUsers(msg: any, users: string | string[], options?: MessageOptions): Promise<any> {
        this.textMsg = msg;
        return Promise.resolve(); // fake a return value
    }

    public addressChannels(msg: any, channels: string | string[], options?: MessageOptions): Promise<any> {
        this.textMsg = msg;
        return Promise.resolve(); // fake a return value
    }

    public respond(msg: any, options?: MessageOptions): Promise<any> {
        this.textMsg = msg;
        return Promise.resolve(); // fake a return value
    }

    public send(msg: any, destinations: Destination | Destination[], options?: MessageOptions): Promise<any> {
        this.textMsg = msg;
        return Promise.resolve(); // fake a return value
    }
}
