import * as assert from "power-assert";
const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {DevOpsEnvironmentRequested} from "../../../src/gluon/team/DevOpsEnvironmentRequested";
import {TestMessageClient} from "../TestMessageClient";

describe("Onboard new member test", () => {
    it("should welcome new user", done => {
        const mock = new MockAdapter(axios);

        mock.onPost(`${QMConfig.subatomic.gluon.baseUrl}/members`).reply(200, {
            firstName: "Test",
            lastName: "User",
            email: "test.user@foo.co.za",
            domainUsername: "tete528",
            slack: {
                screenName: "test.user",
                userId: "9USDA7D6dH",
            },
        });

        const subject = new DevOpsEnvironmentRequested();

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        subject.handle(fakeContext)
            .then(() => {
                assert(fakeContext.messageClient.textMsg.text.trim() === "Welcome to the Subatomic environment *Test*!\nNext steps are to either join an existing team or create a new one.");
                return Promise.resolve();
            })
            .then(done, done);
    });
});
