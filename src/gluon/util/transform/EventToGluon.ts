import {QMMemberBase} from "../member/Members";
import {QMTeam} from "../team/Teams";
import {GluonTeamEvent} from "./types/event/GluonTeamEvent";
import {MemberEvent} from "./types/event/MemberEvent";

export class EventToGluon {

    public static gluonTeam(eventTeam: GluonTeamEvent): QMTeam {
        return {
            teamId: eventTeam.teamId,
            name: eventTeam.name,
            openShiftCloud: eventTeam.openShiftCloud,
            slack: eventTeam.slackIdentity,
            owners: eventTeam.owners.map(owner => EventToGluon.gluonMember(owner)),
            members: eventTeam.members.map(member => EventToGluon.gluonMember(member)),
            description: eventTeam.description,
        };
    }

    public static gluonMember(eventMember: MemberEvent): QMMemberBase {
        return {
            firstName: eventMember.firstName,
            lastName: eventMember.lastName,
            email: eventMember.email,
            domainUsername: eventMember.domainUsername,
            memberId: eventMember.memberId,
            slack: eventMember.slackIdentity,
        };
    }
}
