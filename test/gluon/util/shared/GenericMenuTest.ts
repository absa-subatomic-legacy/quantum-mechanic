import {Attachment} from "@atomist/slack-messages";
import assert = require("power-assert");
import {OnboardMember} from "../../../../src/gluon/commands/member/OnboardMember";
import {createSortedMenuAttachment} from "../../../../src/gluon/util/shared/GenericMenu";

describe("createSortedMenuAttachment", () => {
    it("should return Slack menu attachment with sorted entries", async () => {

        const menuAttachment: Attachment = createSortedMenuAttachment([
            {value: "1", text: "b"},
            {value: "2", text: "a"},
            {value: "3", text: "c"},
        ], new OnboardMember(), {
            text: "Hello",
            fallback: "Hello Fallback",
            selectionMessage: "Select please",
            resultVariableName: "email",
        });

        assert.equal(menuAttachment.text, `Hello`);
        assert.equal(menuAttachment.actions[0].options[0].text, "a");
        assert.equal(menuAttachment.actions[0].options[1].text, "b");
        assert.equal(menuAttachment.actions[0].options[2].text, "c");

        assert.equal(menuAttachment.actions[0].options[0].value, "2");
        assert.equal(menuAttachment.actions[0].options[1].value, "1");
        assert.equal(menuAttachment.actions[0].options[2].value, "3");
    });
});
