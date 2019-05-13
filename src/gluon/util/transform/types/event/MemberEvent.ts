import {SlackIdentityMemberEvent} from "./SlackIdentityMemberEvent";

export interface MemberEvent {
    memberId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    domainUsername?: string;
    slackIdentity?: SlackIdentityMemberEvent;
}
