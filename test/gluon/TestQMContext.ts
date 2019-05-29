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

    public responseMessagesSent: SlackMessage[] = [];
    public channelMessagesSent: SlackMessage[] = [];
    public userMessagesSent: SlackMessage[] = [];

    public createChannelMessageClient(): DirectedQMMessageClient {
        return new TestDirectedQMMessageClient();
    }

    public createResponderMessageClient(): SimpleQMMessageClient {
        return new TestSimpleQMMessageClient();
    }

    public createUserMessageClient(): DirectedQMMessageClient {
        return new TestDirectedQMMessageClient();
    }

    public async respond(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.responseMessagesSent.push({text: message});
        } else {
            this.responseMessagesSent.push(message);
        }
        return await success();
    }

    public async sendToChannels(message: string | SlackMessage, channels: string[], options?: MessageOptions): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.channelMessagesSent.push({text: message});
        } else {
            this.channelMessagesSent.push(message);
        }
        return await success();
    }

    public async sendToUsers(message: string | SlackMessage, users: string[], options?: MessageOptions): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.userMessagesSent.push({text: message});
        } else {
            this.userMessagesSent.push(message);
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
    public messagesSent: SlackMessage[] = [];

    public async send(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.messagesSent.push({text: message});
        } else {
            this.messagesSent.push(message);
        }

        return await success();
    }
}

export class TestDirectedQMMessageClient implements DirectedQMMessageClient {
    public messagesSent: SlackMessage[] = [];
    public destinations: string[] = [];

    public async send(message: string | SlackMessage, options?: MessageOptions): Promise<HandlerResult> {
        if (typeof message === "string") {
            this.messagesSent.push({text: message});
        } else {
            this.messagesSent.push(message);
        }
        return await success();
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
