import {
    HandlerResult,
    MessageOptions,
    success,
} from "@atomist/automation-client";
import {SlackMessage} from "@atomist/slack-messages";
import {QMContext} from "../../src/context/QMContext";
import {QMGraphClient} from "../../src/context/QMGraphClient";
import {
    DirectedQMMessageClient,
    QMMessageClient,
    SimpleQMMessageClient,
} from "../../src/context/QMMessageClient";

export class TestQMContext implements QMContext {

    public eventsRaised: Array<{ eventData: any, eventName: string }> = [];
    public graphClient: TestQMGraphClient = new TestQMGraphClient();
    public messageClient: TestQMMessageClient = new TestQMMessageClient();

    public async raiseEvent(eventData: any, eventName: string): Promise<HandlerResult> {
        this.eventsRaised.push({eventName, eventData});
        return await success();
    }

}

export class TestQMMessageClient implements QMMessageClient {

    public responseMessagesSent: MessageSent[] = [];
    public channelMessagesSent: DirectedMessageSent[] = [];
    public userMessagesSent: DirectedMessageSent[] = [];

    public createChannelMessageClient(): DirectedQMMessageClient {
        return new TestChannelQMMessageClient(this);
    }

    public createResponderMessageClient(): SimpleQMMessageClient {
        return new TestSimpleQMMessageClient(this);
    }

    public createUserMessageClient(): DirectedQMMessageClient {
        return new TestUserQMMessageClient(this);
    }

    public async respond(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        return this.respondWithLabel(message, options, "internal");
    }

    public async respondWithLabel(message: string | SlackMessage, options?: MessageOptions, label?: string): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.responseMessagesSent.push({
                    message: {text: message},
                    label,
                },
            );
        } else {
            this.responseMessagesSent.push({
                message,
                label,
            });
        }
        return await success();
    }

    public async sendToChannels(message: string | SlackMessage, channels: string[], options?: MessageOptions): Promise<HandlerResult> {
        return this.sendToChannelsWithLabel(message, channels, options, "internal");
    }

    public async sendToChannelsWithLabel(message: string | SlackMessage, channels: string[], options?: MessageOptions, label?: string): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.channelMessagesSent.push({
                message: {text: message},
                label,
                destinations: channels,
            });
        } else {
            this.channelMessagesSent.push({
                message,
                label,
                destinations: channels,
            });
        }
        return await success();
    }

    public async sendToUsers(message: string | SlackMessage, users: string[], options?: MessageOptions): Promise<HandlerResult> {
        return this.sendToUsersWithLabel(message, users, options, "label");
    }

    public async sendToUsersWithLabel(message: string | SlackMessage, users: string[], options?: MessageOptions, label?: string): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.userMessagesSent.push({
                message: {text: message},
                label,
                destinations: users,
            });
        } else {
            this.userMessagesSent.push({
                message,
                label,
                destinations: users,
            });
        }
        return await success();
    }
}

export class TestQMGraphClient implements QMGraphClient {
    public usersInvitedToSlackChannel: Array<{ slackChannelId: string, slackUserId: string }> = [];
    public usersKickedFromSlackChannel: Array<{ slackChannelId: string, slackUserId: string }> = [];
    public inviteUserToChannelResponse: Array<{ success: boolean, body: any }> = [];
    public kickUserFromChannelResponse: Array<{ success: boolean, body: any }> = [];

    public async inviteUserToSlackChannel(slackTeamId: string, slackChannelId: string, slackUserId: string): Promise<any> {
        this.usersInvitedToSlackChannel.push({slackChannelId, slackUserId});
        if (this.inviteUserToChannelResponse.length === 0) {
            return success();
        } else {
            const response = this.inviteUserToChannelResponse.pop();
            if (!response.success) {
                throw response.body;
            } else {
                return await response.body;
            }
        }
    }

    public async kickUserFromSlackChannel(slackTeamId: string, slackChannelId: string, slackUserId: string): Promise<any> {
        this.usersKickedFromSlackChannel.push({slackChannelId, slackUserId});
        if (this.inviteUserToChannelResponse.length === 0) {
            return await "kicked";
        } else {
            const response = this.kickUserFromChannelResponse.pop();
            if (!response.success) {
                throw response.body;
            } else {
                return response.body;
            }
        }
    }

    public async slackChannelIdFromChannelName(channelName: string): Promise<string> {
        return await channelName + "ID";
    }

    public async slackScreenNameFromSlackUserId(slackUserId: string): Promise<string> {
        return await slackUserId + "ID";
    }

}

export class TestSimpleQMMessageClient implements SimpleQMMessageClient {
    constructor(private messageClientBase: TestQMMessageClient) {
    }

    public async send(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        return this.messageClientBase.respondWithLabel(message, options, "external");
    }
}

export class TestUserQMMessageClient implements DirectedQMMessageClient {

    public destinations: string[] = [];

    constructor(private messageClientBase: TestQMMessageClient) {
    }

    public async send(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        return this.messageClientBase.sendToUsersWithLabel(message, this.destinations, options, "external");
    }

    public addDestination(user: string) {
        this.destinations.push(user);
        return this;
    }

    public clearDestinations() {
        this.destinations = [];
        return this;
    }
}

export class TestChannelQMMessageClient implements DirectedQMMessageClient {

    public destinations: string[] = [];

    constructor(private messageClientBase: TestQMMessageClient) {
    }

    public async send(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        return this.messageClientBase.sendToChannelsWithLabel(message, this.destinations, options, "external");
    }

    public addDestination(user: string) {
        this.destinations.push(user);
        return this;
    }

    public clearDestinations() {
        this.destinations = [];
        return this;
    }
}

export interface MessageSent {
    message: SlackMessage;
    label: string;
}

export interface DirectedMessageSent extends MessageSent {
    destinations: string[];
}
