import {SlackDestination} from "@atomist/automation-client";
import * as assert from "power-assert";
import {QMConfig} from "../../../../src/config/QMConfig";
import {OnboardMember} from "../../../../src/gluon/commands/member/OnboardMember";
import {GluonService} from "../../../../src/gluon/services/gluon/GluonService";
import {AwaitAxios} from "../../../../src/http/AwaitAxios";
import {TestGraphClient} from "../../TestGraphClient";
import {TestMessageClient} from "../../TestMessageClient";

const MockAdapter = require("axios-mock-adapter");

describe("Onboard new member test", () => {

    it("should welcome new user (no secondary channels)", async () => {

        QMConfig.secondarySlackChannels = [];

        const axiosWrapper = new AwaitAxios();
        const mock = new MockAdapter(axiosWrapper.axiosInstance);

        mock.onPost(`${QMConfig.subatomic.gluon.baseUrl}/members`).reply(201, {
            firstName: "Wang1",
            lastName: "User",
            email: "test.user@foo.co.za",
            domainUsername: "tete528",

            slack: {
                screenName: "Jason",
                userId: "9USDA7D6dH",
            },
        });

        const gluonService = new GluonService(axiosWrapper);

        const subject = new OnboardMember(gluonService);
        subject.domainUsername = "tete528";
        subject.email = "test.user@foo.co.za";
        subject.firstName = "Wang1";
        subject.userId = "9USDA7D6dH";
        subject.lastName = "User";
        subject.screenName = "Jason";

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            workspaceId: "2341234123",
            messageClient: new TestMessageClient(),
            graphClient: new TestGraphClient(),
        };

        // fake results from inner methods
        fakeContext.graphClient.executeQueryResults.push({result: true, returnValue: {ChatTeam: [{id: "TCZLW7AT0"}]}});

        fakeContext.graphClient.executeQueryResults.push({
            result: true,
            returnValue: {
                ChatChannel: [{
                    id: "AI6DFNN4K_CFN59SHPY",
                    name: "subatomic-discussion",
                    channelId: "CFN59SHPY",
                }],
            },
        });

        fakeContext.graphClient.executeQueryResults.push({
            result: true,
            returnValue: {inviteUserToSlackChannel: {id: "CFN59SHPY"}},
        });

        fakeContext.graphClient.executeQueryResults.push({
            result: true,
            returnValue: {
                SlackDestination: {
                    team: "TCZLW7AT0",
                    userAgent: "slack",
                    users: ["UE8SGB4QK"],
                    channels: ["abc", "def"],
                },
            },
        });

        await subject.handle(fakeContext);
        assert(fakeContext.messageClient.textMsg[0].text.trim() === "🚀 Welcome to the Subatomic environment *Wang1*!\n\n\n\nNext steps are to either join an existing team or create a new one.");
    });
});
