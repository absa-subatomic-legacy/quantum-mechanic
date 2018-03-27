import "mocha";
import * as assert from "power-assert";
const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {AddMemberToTeam, JoinTeam} from "../../../src/gluon/team/JoinTeam";
import {TestGraphClient} from "../TestGraphClient";
import {TestMessageClient} from "../TestMessageClient";

describe("Join team tests", () => {
    it("should ask for team selection", done => {
        const mock = new MockAdapter(axios);
        const slackName = "Test.User";
        const teamId = "197c1bb3-9c1d-431f-8db3-2188b9c75dce";
        const name = "test";

        mock.onGet(`${QMConfig.subatomic.gluon.baseUrl}/teams`).reply(200, {
            _embedded: {
                teamResources: [
                    {
                        teamId: `${teamId}`,
                        name: `${name}`,
                    },
                ],
            },
        });

        const subject = new JoinTeam();
        subject.slackName = `${slackName}`;

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        subject.handle(fakeContext)
            .then(() => {
                assert( fakeContext.messageClient.textMsg.text === `Please select the team you would like to join`);
            })
            .then(done, done);
    });

    it("should add member to team", done => {
        const mock = new MockAdapter(axios);
        const screenName = "Test.User";
        const teamId = "79c41ee3-f092-4664-916f-da780195a51e";
        const channelId = "3d01d401-abb3-4eee-8884-2ed5a472172d";
        const teamChannel = "test-channel";
        const slackName = "<@Test.User>";
        const role = "";
        const chatId = "Test.User";

        mock.onGet(`${QMConfig.subatomic.gluon.baseUrl}/members?slackScreenName=${chatId}`).reply(200, {
            _embedded: {
                teamMemberResources: [
                    {
                        memberId: "3d01d401-abb3-4eee-8884-2ed5a472172d",
                        firstName: "Test",
                        lastName: "User",
                        teamId: `${teamId}`,
                        slack: {
                            screenName: `${screenName}`,
                            userId: "9USDA7D6dH",
                        },
                        teams: [{
                            name: "test-channel",
                            slack: {
                                teamChannel: "test-channel",
                            },
                            _links: {
                                self: {
                                    href: `http://localhost:8080/teams/${teamId}`,
                                },
                            },
                        }],
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
            graphClient: new TestGraphClient(),
        };

        subject.handle(fakeContext)
            .then(() => {
                assert(fakeContext.messageClient.textMsg.text === "Welcome to the team *Test*!");
            })
            .then(done, done);
    });
});
