import {
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    SuccessPromise,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {BaseQMEvent} from "../../util/shared/BaseQMEvent";

@EventHandler("Receive TeamMemberCreated events", `
subscription TeamMemberCreatedEvent {
  TeamMemberCreatedEvent {
    id
    memberId
    firstName
    lastName
    email
    domainCredentials {
      domain
      username
      password
    }
  }
}
`)
export class TeamMemberCreated extends BaseQMEvent implements HandleEvent<any> {

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested TeamMemberCreated event: ${JSON.stringify(event.data)}`);
        try {
            this.succeedEvent();
            return await SuccessPromise;
        } catch (error) {
            this.failEvent();
            throw error;
        }
    }
}
