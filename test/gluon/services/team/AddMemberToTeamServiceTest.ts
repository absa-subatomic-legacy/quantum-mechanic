import assert = require("power-assert");
import {instance, mock, when} from "ts-mockito";
import {GluonService} from "../../../../src/gluon/services/gluon/GluonService";
import {MemberService} from "../../../../src/gluon/services/gluon/MemberService";
import {AddMemberToTeamService} from "../../../../src/gluon/services/team/AddMemberToTeamService";
import {QMError} from "../../../../src/gluon/util/shared/Error";

describe("AddMemberToTeamService getNewMember", () => {
    it("should return error that member is part of team already", async () => {
        const mockedMemberService = mock(MemberService);
        when(mockedMemberService.gluonMemberFromScreenName("Dex")).thenReturn(Promise.resolve({
            id: "User1",
            teams: [
                {
                    slack: {
                        teamChannel: "Channel1",
                    },
                },
            ],
            slack: {
                screenName: "Dex",
            },
        }));
        const gluonService = new GluonService(undefined, instance(mockedMemberService));
        const service = new AddMemberToTeamService(gluonService);

        let errorThrown: QMError = null;
        try {
            await service.getNewMember("Dex", "Channel1");
        } catch (error) {
            errorThrown = error;
        }

        assert.equal(errorThrown.message, `Dex is already a member of this team.`);

    });
});
