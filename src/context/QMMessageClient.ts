import {
    addressSlackChannelsFromContext,
    addressSlackUsersFromContext,
    HandlerContext,
    HandlerResult,
    MessageOptions,
} from "@atomist/automation-client";
import {SlackMessage} from "@atomist/slack-messages";

export interface QMMessageClient {
    channelMessageClient: ChannelMessageClient;
    responderMessageClient: SimpleQMMessageClient;
    userMessageClient: UserMessageClient;
}

export class AtomistQMMessageClient implements QMMessageClient {
    public channelMessageClient: ChannelMessageClient;
    public responderMessageClient: ResponderMessageClient;
    public userMessageClient: UserMessageClient;

    constructor(ctx: HandlerContext) {
        this.channelMessageClient = new ChannelMessageClient(ctx);
        this.responderMessageClient = new ResponderMessageClient(ctx);
        this.userMessageClient = new UserMessageClient(ctx);
    }
}

export interface SimpleQMMessageClient {
    send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult>;
}

export class ResponderMessageClient implements SimpleQMMessageClient {
    private ctx: HandlerContext;

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
    }

    public async send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult> {
        return await this.ctx.messageClient.respond(message, options);
    }
}

export class UserMessageClient implements SimpleQMMessageClient {
    private readonly ctx: HandlerContext;
    private users: string[];

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
        this.users = [];
    }

    public addDestination(user: string) {
        this.users.push(user);
        return this;
    }

    public clearDestinations() {
        this.users = [];
        return this;
    }

    public async send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult> {
        const slackDestination = await addressSlackUsersFromContext(this.ctx, ...this.users);
        return await this.ctx.messageClient.send(message, slackDestination, options);
    }

    public async sendToUsers(message: (string | SlackMessage), users: string[], options?: MessageOptions) {
        const slackDestination = await addressSlackUsersFromContext(this.ctx, ...users);
        return await this.ctx.messageClient.send(message, slackDestination, options);
    }
}

export class ChannelMessageClient implements SimpleQMMessageClient {
    private readonly ctx: HandlerContext;
    private channels: string[];

    constructor(ctx: HandlerContext) {
        this.ctx = ctx;
        this.channels = [];
    }

    public addDestination(channel: string) {
        this.channels.push(channel);
        return this;
    }

    public clearDestinations() {
        this.channels = [];
        return this;
    }

    public async send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult> {
        const slackDestination = await addressSlackChannelsFromContext(this.ctx, ...this.channels);
        return await this.ctx.messageClient.send(message, slackDestination, options);
    }

    public async sendToChannels(message: (string | SlackMessage), channels: string[], options?: MessageOptions) {
        const slackDestination = await addressSlackChannelsFromContext(this.ctx, ...channels);
        return await this.ctx.messageClient.send(message, slackDestination, options);
    }
}
