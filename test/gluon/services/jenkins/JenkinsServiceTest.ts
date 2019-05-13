import {AxiosResponse} from "axios";
import assert = require("power-assert");
import {anything, capture, instance, mock, when} from "ts-mockito";
import {JenkinsNetworkHandler} from "../../../../src/gluon/services/jenkins/JenkinsNetworkHandler";
import {JenkinsService} from "../../../../src/gluon/services/jenkins/JenkinsService";

describe("JenkinsService createCredentials", () => {

    it("with global credentials folder should send through correct parameters to genericJenkinsPost", async () => {

        const mockedJenkinsNetworkHandler: JenkinsNetworkHandler = mock(JenkinsNetworkHandler);
        const jenkinsNetworkHandlerInstance = instance(mockedJenkinsNetworkHandler);

        const service = new JenkinsService();
        service.jenkinsNetworkHandlerInstance = jenkinsNetworkHandlerInstance;

        await service.createCredentials(
            "host.com",
            "1",
            {a: 1});

        const [url, body, token, contentType] = capture(mockedJenkinsNetworkHandler.genericJenkinsPost).last();
        assert.equal(url, "https://host.com/credentials/store/system/domain/_/createCredentials");
        assert.equal(body.json, "{\"a\":1}");
        assert.equal(token, "1");
        assert.equal(contentType, "application/x-www-form-urlencoded;charset=UTF-8");

    });

    it("with custom credentials folder should send through correct parameters to genericJenkinsPost", async () => {

        const mockedJenkinsNetworkHandler: JenkinsNetworkHandler = mock(JenkinsNetworkHandler);
        const jenkinsNetworkHandlerInstance = instance(mockedJenkinsNetworkHandler);

        const service = new JenkinsService();
        service.jenkinsNetworkHandlerInstance = jenkinsNetworkHandlerInstance;

        await service.createCredentials(
            "host.com",
            "1",
            {a: 1},
            {
                domain: "Custom",
                jobName: "Some Job",
            });

        const [url, body, token, contentType] = capture(mockedJenkinsNetworkHandler.genericJenkinsPost).last();
        assert.equal(url, "https://host.com/job/Some Job/credentials/store/folder/domain/Custom/createCredentials");
        assert.equal(body.json, "{\"a\":1}");
        assert.equal(token, "1");
        assert.equal(contentType, "application/x-www-form-urlencoded;charset=UTF-8");

    });
});

describe("JenkinsService getProjectCredentialsDomain", () => {

    it("should return correctly formatted name", async () => {

        const service = new JenkinsService();

        const projectCredentialsDomain = service.getProjectCredentialsDomain("Project");

        assert.equal(projectCredentialsDomain, "Project Credentials");
    });
});

describe("JenkinsService createBuildViewForApplication", () => {

    it("with new view successfully created expect a 200 response", async () => {

        const mockedJenkinsNetworkHandler: JenkinsNetworkHandler = mock(JenkinsNetworkHandler);
        const responseFailure: AxiosResponse = {
            status: 400,
            config: undefined,
            data: undefined,
            headers: undefined,
            request: undefined,
            statusText: undefined,
        };
        const responseSuccess: AxiosResponse = {
            status: 200,
            config: undefined,
            data: undefined,
            headers: undefined,
            request: undefined,
            statusText: undefined,
        };
        when(
            mockedJenkinsNetworkHandler.genericJenkinsGet("https://host.com/job/project/view/App", "1"),
        ).thenResolve(responseFailure);
        when(
            mockedJenkinsNetworkHandler.genericJenkinsPost("https://host.com/job/project/createView",

                anything(),
                "1",
                "application/x-www-form-urlencoded;charset=UTF-8",
            ),
        ).thenResolve(responseSuccess);

        const jenkinsNetworkHandlerInstance = instance(mockedJenkinsNetworkHandler);

        const service = new JenkinsService();
        service.jenkinsNetworkHandlerInstance = jenkinsNetworkHandlerInstance;

        const result = await service.createBuildViewForApplication(
            "host.com",
            "1",
            "project",
            "app");

        assert.equal(result.status, 200);
    });

    it("with new view already exists expect a 200 response", async () => {

        const mockedJenkinsNetworkHandler: JenkinsNetworkHandler = mock(JenkinsNetworkHandler);
        const responseSuccess: AxiosResponse = {
            status: 200,
            config: undefined,
            data: undefined,
            headers: undefined,
            request: undefined,
            statusText: "View Exists",
        };
        when(
            mockedJenkinsNetworkHandler.genericJenkinsGet("https://host.com/job/project/view/App", "1"),
        ).thenResolve(responseSuccess);

        const jenkinsNetworkHandlerInstance = instance(mockedJenkinsNetworkHandler);

        const service = new JenkinsService();
        service.jenkinsNetworkHandlerInstance = jenkinsNetworkHandlerInstance;

        const result = await service.createBuildViewForApplication(
            "host.com",
            "1",
            "project",
            "app");

        assert.equal(result.status, 200);
        assert.equal(result.statusText, "View Exists");
    });
});

describe("JenkinsService addBuildJobToApplicationView", () => {

    it("with standard values should call a properly formatted request url", async () => {

        const mockedJenkinsNetworkHandler: JenkinsNetworkHandler = mock(JenkinsNetworkHandler);
        const jenkinsNetworkHandlerInstance = instance(mockedJenkinsNetworkHandler);

        const service = new JenkinsService();
        service.jenkinsNetworkHandlerInstance = jenkinsNetworkHandlerInstance;

        await service.addBuildJobToApplicationView(
            "host.com",
            "1",
            "project",
            "an-application-name",
            "An Application");

        const [url] = capture(mockedJenkinsNetworkHandler.genericJenkinsPost).last();
        assert.equal(url, "https://host.com/job/project/view/An Application Name/addJobToView?name=an-application");

    });
});
