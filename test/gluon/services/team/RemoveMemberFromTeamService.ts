import {url} from "@atomist/slack-messages";
import assert = require("power-assert");
import {anything, instance, mock, when} from "ts-mockito";
import {QMConfig} from "../../../../src/config/QMConfig";
import {GluonService} from "../../../../src/gluon/services/gluon/GluonService";
import {MemberService} from "../../../../src/gluon/services/gluon/MemberService";
import {TeamService} from "../../../../src/gluon/services/gluon/TeamService";
import {AddMemberToTeamService} from "../../../../src/gluon/services/team/AddMemberToTeamService";
import {MemberRole} from "../../../../src/gluon/util/member/Members";
import {QMError} from "../../../../src/gluon/util/shared/Error";
import {TestGraphClient} from "../../TestGraphClient";
import {TestMessageClient} from "../../TestMessageClient";
import {RemoveMemberFromTeamService} from "../../../../src/gluon/services/team/RemoveMemberFromTeamService";

describe("RemoveMemberFromTeamService getMemberGluonDetails", () => {
    it("should return existing member details", async () => {
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
        const gluonService = new GluonService(undefined, undefined, instance(mockedMemberService));
        const service = new RemoveMemberFromTeamService(gluonService);
        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
        };

        const result = await service.getMemberGluonDetails(fakeContext, "Dex", "Channel2");

        assert.equal(result.id, "User1");

    });
});

const team = {
    teamId: "a6ec2bfd-2e9d-46ea-b6bd-cd40ec00cdbf",
    name: "tyhjertfbj",
    description: "tyhebdchjk",
    openShiftCloud: "b-cloud",
    createdAt: "2019-02-12T07:28:25.413+0000",
    createdBy: "3acaa1ea-94e6-4b34-a0cd-a84447909de1",
    slack: {
        teamChannel: "tyhjertfbj",
    },
    members: [
        {
            memberId: "6ca0e380-eb36-4c86-b883-d8f1c7946930",
            firstName: "member",
            lastName: "role",
            email: "bjoma@yahoo.com",
            domainUsername: "yahoo\\bilal",
            joinedAt: "2019-02-12T07:30:53.713+0000",
            slack: {
                screenName: "test",
                userId: "UFYLKAQA",
            },
            _links: {
                self: {
                    href: "http://localhost:8080/members/6ca0e380-eb36-4c86-b883-d8f1c7946930",
                },
            },
        },
    ],
    owners: [
        {
            memberId: "3acaa1ea-94e6-4b34-a0cd-a84447909de1",
            firstName: "bilal",
            lastName: "jooma",
            email: "bilal.jooma@absa.co.za",
            domainUsername: "d_absa\\abbj153",
            joinedAt: "2019-02-12T07:27:45.518+0000",
            slack: {
                screenName: "test2ma",
                userId: "UDC899P",
            },
            _links: {
                self: {
                    href: "http://localhost:8080/members/3acaa1ea-94e6-4b34-a0cd-a844909de1",
                },
            },
        },
    ],
    membershipRequests: [],
    devOpsEnvironment: null,
    _links: {
        self: {
            href: "http://localhost:8080/teams/a6ec2bfd-2e9d-46ea-b6bd-cd40ec00bf",
        },
    },
};

const ownerId = "3acaa1ea-94e6-4b34-a0cd-a84447909de1";
const memeberId = "6ca0e380-eb36-4c86-b883-d8f1c7946930";

xdescribe("AddMemberToTeamService removeUserFromGluonTeam", () => {
    it("should fail to remove a member to gluon team", async () => {
        const mockedTeamService = mock(TeamService);
        when(mockedTeamService.removeMemberFromTeam(team.teamId, memeberId, ownerId)).thenReturn(Promise.resolve({
            status: 400,
        }));
        const gluonService = new GluonService(undefined, instance(mockedTeamService));
        const service = new RemoveMemberFromTeamService(gluonService);

        let errorThrown: QMError = null;
        try {
            await service.removeUserFromGluonTeam(team.teamId, memeberId, ownerId);
        } catch (error) {
            errorThrown = error;
        }

        assert.equal(errorThrown.getSlackMessage().text, `❗Failed to remove member from the team.`);

    });

    it("should successfully remove a member from a gluon team", async () => {
        const mockedTeamService = mock(TeamService);
        when(mockedTeamService.removeMemberFromTeam(team.teamId, memeberId, ownerId)).thenReturn(Promise.resolve({
            status: 200,
        }));
        const gluonService = new GluonService(undefined, instance(mockedTeamService));
        const service = new RemoveMemberFromTeamService(gluonService);

        let errorThrown: boolean = false;
        try {
            await service.removeUserFromGluonTeam(team.teamId, memeberId, ownerId);
        } catch (error) {
            errorThrown = true;
        }

        assert.equal(errorThrown, false);

    });
});