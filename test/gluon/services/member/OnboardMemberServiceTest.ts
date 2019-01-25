import {url} from "@atomist/slack-messages";
import assert = require("power-assert");
import {TestGraphClient} from "../../TestGraphClient";
import {TestMessageClient} from "../../TestMessageClient";
import {OnboardMemberService} from "../../../../src/gluon/services/member/OnboardMemberService";

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

        assert.equal(fakeContext.messageClient.textMsg[0], `Invitation to channel *channel1* failed for *Howard*.\nNote, private channels do not currently support automatic user invitation.\n` +
            `Please invite the user to this slack channel manually.`);
    });
});
