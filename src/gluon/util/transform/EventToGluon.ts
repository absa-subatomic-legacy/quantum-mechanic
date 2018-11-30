import {QMTeam} from "../team/Teams";

export class EventToGluon {

    public static gluonTeam(eventTeam): QMTeam {
        return {
            teamId: eventTeam.teamId,
            name: eventTeam.name,
            openShiftCloud: eventTeam.openShiftCloud,
            slack: eventTeam.slackIdentity,
            owners: eventTeam.owners,
            members: eventTeam.members,
        };
    }
}
