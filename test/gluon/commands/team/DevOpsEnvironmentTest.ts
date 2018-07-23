import "mocha";
import * as assert from "power-assert";
const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../../src/config/QMConfig";
import {NewDevOpsEnvironment} from "../../../../src/gluon/commands/team/DevOpsEnvironment";
import {TestMessageClient} from "../../TestMessageClient";

describe("Create a new or use an existing Openshift DevOps environment", () => {
    it("Should use existing DevOps environment", async () => {
        const mock = new MockAdapter(axios);
        const teamName = "test_name";
        const screenName = "Test.User";
        const teamChannel = "test_channel";
        const teamId = "79c41ee3-f092-4664-916f-da780195a51e";
        const memberId = "3d01d401-abb3-4eee-8884-2ed5a472172d";

        mock.onGet(`${QMConfig.subatomic.gluon.baseUrl}/teams?name=${teamName}`).reply(200, {
            _embedded: {
                teamResources: [
                    {
                        memberId: `${memberId}`,
                        teamId: `${teamId}`,
                        slack: {
                            screenName: `${screenName}`,
                            userId: "9USDA7D6dH",
                        },
                    },
                ],
            },
        });

        mock.onGet(`${QMConfig.subatomic.gluon.baseUrl}/teams?slackTeamChannel=${teamChannel}`).reply(200, {
            _embedded: {
                teamResources: [
                    {
                        name: `${teamName}`,
                        memberId: `${memberId}`,
                        teamId: `${teamId}`,
                        slack: {
                            screenName: `${screenName}`,
                            userId: "9USDA7D6dH",
                            teamChannel: `${teamChannel}`,
                        },
                    },
                ],
            },
        });

        mock.onGet(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${screenName}`).reply(200, {
            _embedded: {
                teamMemberResources: [
                    {
                        memberId: `${memberId}`,
                        teamId: `${teamId}`,
                        slack: {
                            screenName: `${screenName}`,
                            userId: "9USDA7D6dH",
                        },
                    },
                ],
            },
        });

        mock.onPut(`${QMConfig.subatomic.gluon.baseUrl}/teams/${teamId}`).reply(200, {
            devOpsEnvironment: {
                requestedBy: `${memberId}`,
            },
        });

        const subject = new NewDevOpsEnvironment();
        subject.teamName = `${teamName}`;
        subject.teamChannel = `${teamChannel}`;
        subject.screenName = `${screenName}`;

        const fakeContext = {
            teamId: `${teamId}`,
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        await subject.handle(fakeContext);
        assert(fakeContext.messageClient.textMsg.text === `Requesting DevOps environment for *${teamName}* team.`);
    });
});
