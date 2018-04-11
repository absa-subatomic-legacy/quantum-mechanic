import * as assert from "power-assert";
const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {KickOffJenkinsBuild} from "../../../src/gluon/jenkins/JenkinsBuild";
import {TestMessageClient} from "../TestMessageClient";
import {logger, MappedParameter, MappedParameters, Parameter} from "@atomist/automation-client";

describe("Jenkins build test", () => {
    it("should kick off a jenkins build", done => {
        const mock = new MockAdapter(axios);
        const slackName = "<@Test.User>";
        const screenName = "Test.User";
        const teamChannel = "test_channel";
        const teamName = "test_name";
        const projectName = "test_project";
        const applicationName = "test_application";

        const subject = new KickOffJenkinsBuild();
        subject.slackName = `${slackName}`;
        subject.screenName = `${screenName}`;
        subject.teamChannel = `${teamChannel}`;
        subject.teamName = `${teamName}`;
        subject.projectName = `${projectName}`;
        subject.applicationName = `${applicationName}`;

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        subject.handle(fakeContext)
            .then(() => {
                logger.info(fakeContext.messageClient.textMsg);
                //assert(fakeContext.messageClient.textMsg.text.trim() === "Welcome to the Subatomic environment *Test*!\nNext steps are to either join an existing team or create a new one.");
                return Promise.resolve();
            })
            .then(done, done);
    });
});
