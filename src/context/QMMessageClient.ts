import {
    addressSlackChannelsFromContext,
    addressSlackUsersFromContext,
    HandlerContext,
    HandlerResult,
    MessageOptions,
} from "@atomist/automation-client";
import {SlackMessage} from "@atomist/slack-messages";

export interface QMMessageClient {
    createChannelMessageClient(): DirectedQMMessageClient;

    createResponderMessageClient(): SimpleQMMessageClient;

    createUserMessageClient(): DirectedQMMessageClient;

    sendToUsers(message: (string | SlackMessage), users: string[], options?: MessageOptions): Promise<HandlerResult>;

    sendToChannels(message: (string | SlackMessage), channels: string[], options?: MessageOptions): Promise<HandlerResult>;

    respond(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult>;
}

export class AtomistQMMessageClient implements QMMessageClient {

    constructor(private ctx: HandlerContext) {
    }

    public createChannelMessageClient(): ChannelMessageClient {
        return new ChannelMessageClient(this.ctx);
    }

    public createResponderMessageClient(): SimpleQMMessageClient {
        return new ResponderMessageClient(this.ctx);
    }

    public createUserMessageClient(): UserMessageClient {
        return new UserMessageClient(this.ctx);
    }

    public async respond(message: string | SlackMessage, options?: MessageOptions) {
        return await this.ctx.messageClient.respond(message, options);
    }

    public async sendToChannels(message: string | SlackMessage, channels: string[], options?: MessageOptions) {
        const slackDestination = await addressSlackChannelsFromContext(this.ctx, ...channels);
        return await this.ctx.messageClient.send(message, slackDestination, options);
    }

    public async sendToUsers(message: string | SlackMessage, users: string[], options?: MessageOptions) {
        const slackDestination = await addressSlackUsersFromContext(this.ctx, ...users);
        return await this.ctx.messageClient.send(message, slackDestination, options);
    }
}

export interface SimpleQMMessageClient {
    send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult>;
}

export interface DirectedQMMessageClient extends SimpleQMMessageClient {
    send(message: (string | SlackMessage), options?: MessageOptions): Promise<HandlerResult>;

    addDestination(user: string);

    clearDestinations();
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

export class UserMessageClient implements DirectedQMMessageClient {
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
}

export class ChannelMessageClient implements DirectedQMMessageClient {
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
}
