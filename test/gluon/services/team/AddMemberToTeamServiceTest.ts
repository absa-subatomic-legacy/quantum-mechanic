import {logger} from "@atomist/automation-client";
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

describe("AddMemberToTeamService getNewMemberGluonDetails", () => {
    it("should return member details", async () => {
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
        const service = new AddMemberToTeamService(gluonService);
        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
        };

        const result = await service.getNewMemberGluonDetails(fakeContext, "Dex", "Channel2");

        assert.equal(result.id, "User1");

    });
});

describe("AddMemberToTeamService addUserToGluonTeam", () => {
    it("should fail to add member to gluon team", async () => {
        const mockedTeamService = mock(TeamService);
        when(mockedTeamService.addMemberToTeam("team1", anything())).thenReturn(Promise.resolve({
            status: 400,
        }));
        const gluonService = new GluonService(undefined, instance(mockedTeamService));
        const service = new AddMemberToTeamService(gluonService);

        let errorThrown: QMError = null;
        try {
            await service.addUserToGluonTeam("User1", "User2", "team1");
        } catch (error) {
            errorThrown = error;
        }

        assert.equal(errorThrown.getSlackMessage().text, `❗Failed to add member to the team. Server side failure. Consulting the ${url(`${QMConfig.subatomic.docs.baseUrl}/FAQ`, "FAQ")} may be useful.`);

    });

    it("should successfully execute gluon add", async () => {
        const mockedTeamService = mock(TeamService);
        when(mockedTeamService.addMemberToTeam("team1", anything())).thenReturn(Promise.resolve({
            status: 200,
        }));
        const gluonService = new GluonService(undefined, instance(mockedTeamService));
        const service = new AddMemberToTeamService(gluonService);

        let errorThrown: boolean = false;
        try {
            await service.addUserToGluonTeam("User1", "User2", "team1");
        } catch (error) {
            errorThrown = true;
        }

        assert.equal(errorThrown, false);

    });
});

describe("AddMemberToTeamService inviteUserToSlackChannel", () => {

    it("should fail to invite user to channel 403 (private channel type error)", async () => {

        const service = new AddMemberToTeamService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        // Force invite to fail
        fakeContext.graphClient.executeQueryResults.push({result: true, returnValue: {ChatTeam: [{id: "1234"}]}});
        fakeContext.graphClient.executeMutationResults.push({
            result: false,
            returnValue: {networkError: {statusCode: 400}},
        });
        // fakeContext.graphClient.executeMutationResults.push({result: false});

        await service.inviteUserToSlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
            "jude",
        );

        logger.debug(`foo2 = ${JSON.stringify(fakeContext)}`);
        assert.equal(fakeContext.messageClient.textMsg[0], `User *jude* successfully added to your Subatomic team.` +
            ` Invitation to the team channel failed. Private channels do not currently support automatic user invitation.` +
            ` Please invite the user to this slack channel manually.`);
    });

    it("should fail to invite user to channel [non 400 (private channel) error]", async () => {

        const service = new AddMemberToTeamService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        // Force invite to fail
        fakeContext.graphClient.executeQueryResults.push({result: true, returnValue: {ChatTeam: [{id: "1234"}]}});
        fakeContext.graphClient.executeMutationResults.push({
            result: false,
            returnValue: {networkError: {statusCode: 403}},
        });

        await service.inviteUserToSlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
            "jude",
        );

        logger.debug(`foo2 = ${JSON.stringify(fakeContext)}`);
        assert.equal(fakeContext.messageClient.textMsg[0], `User *jude* successfully added to your Subatomic team.` +
            ` The invitation to the team Slack Channel failed for some reason. Please try to invite the user to this slack channel manually.`);
    });

    it("should successfully invite user to channel", async () => {

        const service = new AddMemberToTeamService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        fakeContext.graphClient.executeQueryResults.push({
            result: true,
            returnValue: {ChatTeam: [{id: "1234"}]},
        });

        await service.inviteUserToSlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
            "jude",
        );

        assert.equal(fakeContext.messageClient.textMsg[0].text, "Welcome to the team *Jude*!");
    });
});

describe("AddMemberToTeamService inviteUserToCustomSlackChannel", () => {

    it("should fail to invite user to custom slack channel 400 (private channel type error)", async () => {

        const service = new AddMemberToTeamService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        // Force invite to fail
        fakeContext.graphClient.executeQueryResults.push({result: true, returnValue: {ChatTeam: [{id: "1234"}]}});
        fakeContext.graphClient.executeMutationResults.push({
            result: false,
            returnValue: {networkError: {statusCode: 400}},
        });
        // fakeContext.graphClient.executeMutationResults.push({result: false});

        await service.inviteUserToCustomSlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
            "jude",
        );

        logger.debug(`foo2 = ${JSON.stringify(fakeContext)}`);
        assert.equal(fakeContext.messageClient.textMsg[0], `User *jude* successfully added to your Subatomic team.` +
            ` Invitation to this channel failed. Private channels do not currently support automatic user invitation.` +
            ` Please invite the user to this slack channel manually.`);
    });

    it("should fail to invite user to custom slack channel [non 400 (private channel) error]", async () => {

        const service = new AddMemberToTeamService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        // Force invite to fail
        fakeContext.graphClient.executeQueryResults.push({result: true, returnValue: {ChatTeam: [{id: "1234"}]}});
        fakeContext.graphClient.executeMutationResults.push({
            result: false,
            returnValue: {networkError: {statusCode: 403}},
        });

        await service.inviteUserToCustomSlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
            "jude",
        );

        logger.debug(`foo2 = ${JSON.stringify(fakeContext)}`);
        assert.equal(fakeContext.messageClient.textMsg[0], `User *jude* successfully added to your Subatomic team.` +
            ` The invitation to the custom Slack channels failed for some reason. Please try to invite the user to this slack channel manually.`);
    });

    it("should successfully invite user to custom slack channel", async () => {

        const service = new AddMemberToTeamService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        fakeContext.graphClient.executeQueryResults.push({
            result: true,
            returnValue: {ChatTeam: [{id: "1234"}]},
        });

        await service.inviteUserToCustomSlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
            "jude",
        );

        assert.equal(fakeContext.messageClient.textMsg[0].text, "Welcome to the *channel1* channel!");
    });
});

describe("AddMemberToTeamService verifyAddMemberRequest", () => {
    it("should throw error for existing owner", async () => {

        const service = new AddMemberToTeamService();

        const newMember = {
            memberId: "member1",
            slack: {
                screenName: "Craig",
            },
        };

        const team = {
            owners: [
                {memberId: "member1"},
            ],
            members: [],
        };

        let errorThrown: QMError = null;
        try {
            await service.verifyAddMemberRequest(newMember,
                team,
                MemberRole.owner);
        } catch (error) {
            errorThrown = error;
        }

        assert.equal(errorThrown.message, "Craig is already an owner of this team.");
    });

    it("should throw error for existing member", async () => {

        const service = new AddMemberToTeamService();

        const newMember = {
            memberId: "member1",
            slack: {
                screenName: "Craig",
            },
        };

        const team = {
            owners: [],
            members: [
                {memberId: "member1"},
            ],
        };

        let errorThrown: QMError = null;
        try {
            await service.verifyAddMemberRequest(newMember,
                team,
                MemberRole.member);
        } catch (error) {
            errorThrown = error;
        }

        assert.equal(errorThrown.message, "Craig is already a member of this team.");
    });

    it("should allow an owner to be promoted from member", async () => {

        const service = new AddMemberToTeamService();

        const newMember = {
            memberId: "member1",
            slack: {
                screenName: "Craig",
            },
        };

        const team = {
            owners: [],
            members: [{memberId: "member1"}],
        };

        let errorThrown: boolean = false;
        try {
            await service.verifyAddMemberRequest(newMember,
                team,
                MemberRole.owner);
        } catch (error) {
            errorThrown = true;
        }

        assert.equal(errorThrown, false);
    });

    it("should allow a member to be demoted from owner", async () => {

        const service = new AddMemberToTeamService();

        const newMember = {
            memberId: "member1",
            slack: {
                screenName: "Craig",
            },
        };

        const team = {
            owners: [{memberId: "member1"}],
            members: [],
        };

        let errorThrown: boolean = false;
        try {
            await service.verifyAddMemberRequest(newMember,
                team,
                MemberRole.member);
        } catch (error) {
            errorThrown = true;
        }

        assert.equal(errorThrown, false);
    });
});
