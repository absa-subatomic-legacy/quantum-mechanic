import {SlackIdentityMemberEvent} from "./SlackIdentityMemberEvent";

export interface ActionedByEvent {
    memberId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    domainUsername?: string;
    slackIdentity?: SlackIdentityMemberEvent;
}
