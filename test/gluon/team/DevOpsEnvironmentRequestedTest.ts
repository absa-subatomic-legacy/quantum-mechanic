import * as assert from "power-assert";

const MockAdapter = require("axios-mock-adapter");
import {logger} from "@atomist/automation-client";
import axios from "axios";
import {QMConfig} from "../../../src/config/QMConfig";
import {DevOpsEnvironmentRequested} from "../../../src/gluon/team/DevOpsEnvironmentRequested";
import {OCCommand} from "../../../src/openshift/base/OCCommand";
import {OCCommandResult} from "../../../src/openshift/base/OCCommandResult";
import {OCClient} from "../../../src/openshift/OCClient";
import {TestMessageClient} from "../TestMessageClient";
import {anyString, anything, instance, mock, when} from "ts-mockito";
import {OCCommon} from "../../../src/openshift/OCCommon";

const superagent = require("superagent");
const mockServer = require("mockttp").getLocal();

describe("DevOps environment test", () => {
    beforeEach(() => mockServer.start(8443));
    afterEach(() => mockServer.stop());

    it("should provision an environment", done => {
        const mockedAxios = new MockAdapter(axios);

        mockedAxios.onPost(`${QMConfig.subatomic.gluon.baseUrl}/members`).reply(200, {
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

        logger.info("hello2");

        // Creating mock
        const mockedOCClient: OCClient = mock(OCClient);

        when(mockedOCClient.login(anyString(), anyString())).thenReturn(new Promise((resolve, reject) => {
            logger.verbose(`Executing oc command sync: login}`);
            const response = new OCCommandResult();
            response.command = "oc login";
            response.output = "success";
            response.status = true;

            return resolve(response);
        }));

        logger.info("3");

        when(mockedOCClient.newProject(anyString(), anyString(), anyString())).thenReturn(new Promise((resolve, reject) => {
            logger.verbose(`Executing oc command sync: login}`);
            const response = new OCCommandResult();
            response.command = "oc new-project";
            response.output = "success";
            response.status = true;

            return resolve(response);
        }));

        // Getting instance from mock
        const stubbedOCClient: OCClient = instance(mockedOCClient);

        logger.info("hello");
        const mockedOCCommon: OCCommon = mock(OCCommon);

        when(mockedOCCommon.commonCommand(anyString(), anyString(), anything(), anything(), anything())).thenReturn(new Promise((resolve, reject) => {
            logger.verbose(`Executing oc command sync: login}`);
            const response = new OCCommandResult();
            response.command = "oc common";
            response.output = "success";
            response.status = true;

            return resolve(response);
        }));

        when(mockedOCCommon.createFromFile(anyString(), anything(), anything())).thenReturn(new Promise((resolve, reject) => {
            logger.verbose(`Executing oc command sync: login}`);
            const response = new OCCommandResult();
            response.command = "oc create-from-file";
            response.output = "success";
            response.status = true;

            return resolve(response);
        }));

        const stubbedOCCommon: OCCommon = instance(mockedOCCommon);

        OCCommon.setInstance(stubbedOCCommon);
        OCClient.setInstance(stubbedOCClient);

        /*
        mockServer.get("/mocked-path").thenReply(200, "A mocked response")
            .then(() => {
                // Make a request
                return superagent.get("http://localhost:8443/mocked-path");
            }).then(response => {
            // Assert on the results
            assert(response.text === "A mocked response");
        }).then(done);
        */

        subject.handle(fakeEventFired, fakeContext)
            .then(() => {
                assert(fakeContext.messageClient.textMsg.text.trim() === "Your DevOps environment has been provisioned successfully");
                return Promise.resolve();
            })
            .then(done, done);
    }).timeout(10000);
});
