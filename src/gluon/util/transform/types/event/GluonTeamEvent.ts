import {MemberEvent} from "./MemberEvent";
import {MetaData} from "./MetaData";
import {SlackIdentityTeamEvent} from "./SlackIdentityTeamEvent";

export interface GluonTeamEvent {
    teamId: string;
    name: string;
    description: string;
    slackIdentity: SlackIdentityTeamEvent;
    openShiftCloud: string;
    owners: MemberEvent[];
    members: MemberEvent[];
    metadata: MetaData[];
}
