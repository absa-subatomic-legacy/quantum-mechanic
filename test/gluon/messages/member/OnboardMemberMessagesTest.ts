import assert = require("power-assert");
import {OnboardMemberMessages} from "../../../../src/gluon/messages/member/OnboardMemberMessages";

describe("OnboardMemberMessages presentTeamCreationAndApplicationOptions", () => {
    it("should present message with two buttons", async () => {
        const onboardMemberMessages = new OnboardMemberMessages();

        const result = onboardMemberMessages.presentTeamCreationAndApplicationOptions("Tom");
        assert(result.text.indexOf(`Welcome to the Subatomic environment *Tom*!`) > -1);
        assert(result.attachments.length === 1);
        assert.equal(result.attachments[0].actions[0].type, "button");
        assert.equal(result.attachments[0].actions[0].text, "Apply to join a team");
        assert.equal(result.attachments[0].actions[1].type, "button");
        assert.equal(result.attachments[0].actions[1].text, "Create a new team");
    });
});
