import {url} from "@atomist/slack-messages";
import assert = require("power-assert");
import {OnboardMemberService} from "../../../../src/gluon/services/member/OnboardMemberService";
import {TestGraphClient} from "../../TestGraphClient";
import {TestMessageClient} from "../../TestMessageClient";

describe("AddMemberToTeamService inviteUserToCustomSlackChannel", () => {

    it("should fail to invite user to custom slack channel 400 (private channel type error)", async () => {

        const service = new OnboardMemberService();

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

        await service.inviteUserToSecondarySlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
        );

        assert.equal(fakeContext.messageClient.textMsg[0], "Invitation to channel *channel1* failed for *Howard*.\n Note, private channels do not currently support automatic user invitation.\nPlease invite the user to this slack channel manually.");
    });

    it("should invite user to custom slack channel and return channel name", async () => {

        const service = new OnboardMemberService();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        // fake results from inner methods
        fakeContext.graphClient.executeQueryResults.push({result: true, returnValue: {ChatTeam: [{id: "TCZLW7AT0"}]}});
        fakeContext.graphClient.executeQueryResults.push({
            result: true,
            returnValue: {
                ChatChannel: [{
                    id: "AI6DFNN4K_CFN59SHPY",
                    name: "subatomic-discussion",
                    channelId: "CFN59SHPY",
                }],
            },
        });
        fakeContext.graphClient.executeMutationResults.push({
            result: true,
            returnValue: {inviteUserToSlackChannel: {id: "CFN59SHPY"}},
        });

        const res = await service.inviteUserToSecondarySlackChannel(fakeContext,
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
        );

        assert.equal(res, `channel1`);
    });
});
