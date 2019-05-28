import assert = require("power-assert");
import {OnboardMemberService} from "../../../../src/gluon/services/member/OnboardMemberService";
import {TestQMContext} from "../../TestQMContext";

describe("AddMemberToTeamService inviteUserToCustomSlackChannel", () => {

    it("should fail to invite user to custom slack channel 400 (private channel type error)", async () => {

        const service = new OnboardMemberService();

        const context: TestQMContext = new TestQMContext();
        context.graphClient.inviteUserToChannelResponse.push({
            success: false,
            body: {
                networkError: {
                    statusCode: 400,
                },
            },
        });

        await service.inviteUserToSecondarySlackChannel(context,
            "1234",
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
        );

        assert.equal(context.messageClient.channelMessageClient.messagesSent[0].text, "Invitation to channel *channel1* failed for *Howard*.\n Note, private channels do not currently support automatic user invitation.\nPlease invite the user to this slack channel manually.");
    });

    it("should invite user to custom slack channel and return channel name", async () => {

        const service = new OnboardMemberService();

        const context: TestQMContext = new TestQMContext();

        const res = await service.inviteUserToSecondarySlackChannel(context,
            "12345",
            "Jude",
            "channel1",
            "channe1id",
            "Howard",
        );

        assert.equal(res, "channel1");
    });
});
