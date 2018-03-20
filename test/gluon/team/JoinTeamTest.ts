/*import "mocha"; // this is the test framework
import * as assert from "power-assert"; // this makes the test failures highly informational

const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {TestMessageClient} from "../TestMessageClient";
import {AddMemberToTeam} from "../../../src/gluon/team/JoinTeam";
import {logger, MappedParameter, MappedParameters, Parameter} from "@atomist/automation-client";

describe("Adding member to a team", () => {
    it("should add member to team", done => {
        const mock = new MockAdapter(axios);
        const screenName = "Test.User";
        const teamId = "79c41ee3-f092-4664-916f-da780195a51e";
        const channelId = "3d01d401-abb3-4eee-8884-2ed5a472172d";
        const teamChannel = "test-channel";
        const slackName = "Test.User";
        const role = "";
        const chatId = "Test.User";

        mock.onGet(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${chatId}`).reply(200, {
            _embedded: {
                teamResources: [
                    {
                        memberId: "3d01d401-abb3-4eee-8884-2ed5a472172d",
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
            slack: {
                teamChannel: "test-channel",
            },
        });

        const subject = new AddMemberToTeam();
        subject.screenName = `${screenName}`;
        subject.teamId = `${teamId}`,
        subject.channelId = `${channelId}`,
        subject.teamChannel = `${teamChannel}`,
        subject.slackName = `${slackName}`;

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        subject.handle(fakeContext)
            .then(() => {
                logger.info(JSON.stringify(fakeContext.messageClient));
                //assert(JSON.stringify(fakeContext.messageClient) === "{}");
                return Promise.resolve();
            })
            .then(done, done);
    });
});
*/
