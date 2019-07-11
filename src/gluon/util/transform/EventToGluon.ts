import _ = require("lodash");
import {GluonTeamEvent} from "./types/event/GluonTeamEvent";
import {MemberEvent} from "./types/event/MemberEvent";
import {QMMemberBase} from "./types/gluon/Member";
import {QMTeam} from "./types/gluon/Team";

export class EventToGluon {

    public static gluonTeam(eventTeam: GluonTeamEvent): QMTeam {
        const result = {
            teamId: eventTeam.teamId,
            name: eventTeam.name,
            openShiftCloud: eventTeam.openShiftCloud,
            slack: eventTeam.slackIdentity,
            owners: [],
            members: [],
            description: eventTeam.description,
            metadata: eventTeam.metadata,
        };

        if (!_.isEmpty(eventTeam.members)) {
            result.members = eventTeam.members.map(member => EventToGluon.gluonMember(member));
        }

        if (!_.isEmpty(eventTeam.owners)) {
            result.owners = eventTeam.owners.map(owner => EventToGluon.gluonMember(owner));
        }

        return result;
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
