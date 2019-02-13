import assert = require("power-assert");
import {isMember, isOwner} from "../../../../src/gluon/util/team/Teams";

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

describe("isOwner", () => {

    it("should return true when ownerId is used", async () => {
        const result = isOwner(team, ownerId);

        assert.equal(result, true);
    });

    it("should return flase when the memberId used", async () => {
        const result = isOwner(team, memeberId);

        assert.equal(result, false);
    });
});

describe("isMember", () => {

    it("should return true when memberId is used", async () => {
        const result = isMember(team, memeberId);

        assert.equal(result, true);
    });

    it("should return flase when the member is not the owner", async () => {
        const result = isMember(team, ownerId);

        assert.equal(result, false);
    });
});
