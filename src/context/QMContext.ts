import {
    addressEvent,
    HandlerContext,
    HandlerResult,
} from "@atomist/automation-client";
import {AtomistQMGraphClient, QMGraphClient} from "./QMGraphClient";
import {AtomistQMMessageClient, QMMessageClient} from "./QMMessageClient";

export interface QMContext {
    messageClient: QMMessageClient;

    graphClient: QMGraphClient;

    raiseEvent(eventData: any, eventName: string): Promise<HandlerResult>;
}

export class AtomistQMContext implements QMContext {

    public graphClient: QMGraphClient;
    public messageClient: QMMessageClient;

    constructor(private ctx: HandlerContext) {
        this.graphClient = new AtomistQMGraphClient(ctx);
        this.messageClient = new AtomistQMMessageClient(ctx);
    }

    public async raiseEvent(eventData: any, eventName: string): Promise<HandlerResult> {
        return this.ctx.messageClient.send(eventData, addressEvent(eventName));
    }
}
