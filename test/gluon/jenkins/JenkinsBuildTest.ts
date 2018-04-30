/*import * as assert from "power-assert";

const MockAdapter = require("axios-mock-adapter");
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {KickOffJenkinsBuild} from "../../../src/gluon/jenkins/JenkinsBuild";
import {TestMessageClient} from "../TestMessageClient";
import {logger, MappedParameter, MappedParameters, Parameter} from "@atomist/automation-client";
import {OCCommon} from "../../../src/openshift/OCCommon";
import {anyString, anything, instance, mock, when} from "ts-mockito";
import {OCCommandResult} from "../../../src/openshift/base/OCCommandResult";

describe("Jenkins build test", () => {
    it("should kick off a jenkins build", done => {
        const mockedAxios = new MockAdapter(axios);
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

        mockedAxios.onPost(`https://success/job/test-project/job/test-application/job/master/build?delay=0sec`).reply(200, {
            data: "asdas",
        });

        const fakeContext = {
            teamId: "TEST",
            correlationId: "1231343234234",
            messageClient: new TestMessageClient(),
        };

        const mockedOCCommon: OCCommon = mock(OCCommon);

        when(mockedOCCommon.commonCommand(anyString(), anyString(), anything(), anything(), anything())).thenReturn(new Promise((resolve, reject) => {
            logger.verbose(`Executing oc command sync: common}`);
            const response = new OCCommandResult();
            response.command = "oc other";
            response.output = "success";
            response.status = true;

            return resolve(response);
        }));

        const stubbedOCCommon: OCCommon = instance(mockedOCCommon);

        OCCommon.setInstance(stubbedOCCommon);

        subject.handle(fakeContext)
            .then(() => {
                assert(fakeContext.messageClient.textMsg.text.trim() === `🚀 *${applicationName}* is being built...`);
            })
            .then(done, done);
    });
});
*/
