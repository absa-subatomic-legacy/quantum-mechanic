import * as assert from "power-assert";
const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {DevOpsEnvironmentRequested} from "../../../src/gluon/team/DevOpsEnvironmentRequested";
import {TestMessageClient} from "../TestMessageClient";

describe("DevOps environment test", () => {
    it.skip("should provision an environment", done => {
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
        const json = {
            DevOpsEnvironmentRequestedEvent: [
                {
                    team: {
                        name: "test-team",
                        slackIdentity: {
                            teamChannel: "test-channel",
                        },
                        owners: [
                            {
                                firstName: "Owner",
                                domainUsername: "domain/owner",
                                slackIdentity: {
                                    screenName: "owner.user",
                                },
                            },
                        ],
                        members: [
                            {
                                firstName: "Test",
                                domainUsername: "domain/test",
                                slackIdentity: {
                                    screenName: "test.user",
                                },
                            },
                        ],
                    },
                },
            ],
        };

        const fakeEventFired = {
            data: json,
            extensions: {
                operationName: "test",
            },
        };
        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        subject.handle(fakeEventFired, fakeContext)
            .then(() => {
                assert(fakeContext.messageClient.textMsg.text.trim() === "Your DevOps environment has been provisioned successfully");
                return Promise.resolve();
            })
            .then(done, done);
    }); // timeout(10000);
});
