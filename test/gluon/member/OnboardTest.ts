import * as assert from "power-assert";

const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {
    OnboardMember,
    OnboardMemberMessages,
} from "../../../src/gluon/commands/member/Onboard";
import {TestMessageClient} from "../TestMessageClient";

describe("Onboard new member test", () => {
    it("should welcome new user", async () => {
        const mock = new MockAdapter(axios);

        mock.onPost(`${QMConfig.subatomic.gluon.baseUrl}/members`).reply(201, {
            firstName: "Test",
            lastName: "User",
            email: "test.user@foo.co.za",
            domainUsername: "tete528",
            slack: {
                screenName: "test.user",
                userId: "9USDA7D6dH",
            },
        });

        const subject = new OnboardMember();
        subject.domainUsername = "tete528";
        subject.email = "test.user@foo.co.za";
        subject.firstName = "Test";
        subject.userId = "9USDA7D6dH";
        subject.lastName = "User";

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        await subject.handle(fakeContext);
        assert(fakeContext.messageClient.textMsg.text.trim() === "Welcome to the Subatomic environment *Test*!\nNext steps are to either join an existing team or create a new one.");
    });
});

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
