import {MemberEvent} from "./MemberEvent";
import {SlackIdentityTeamEvent} from "./SlackIdentityTeamEvent";

export interface GluonTeamEvent {
    teamId: string;
    name: string;
    description: string;
    slackIdentity: SlackIdentityTeamEvent;
    openShiftCloud: string;
    owners: MemberEvent[];
    members: MemberEvent[];
}
