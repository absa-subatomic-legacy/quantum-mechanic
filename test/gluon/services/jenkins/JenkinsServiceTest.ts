import assert = require("power-assert");
import {capture, instance, mock} from "ts-mockito";
import {JenkinsService} from "../../../../src/gluon/services/jenkins/JenkinsService";
import {AwaitAxios} from "../../../../src/http/AwaitAxios";

describe("JenkinsService createCredentials", () => {

    it("with global credentials folder should send through correct parameters to genericJenkinsPost", async () => {

        const mockedAxios: AwaitAxios = mock(AwaitAxios);
        const axiosInstance = instance(mockedAxios);

        const service = new JenkinsService(axiosInstance);

        await service.createCredentials(
            "host.com",
            "1",
            {a: 1});

        const [url, body, config] = capture(mockedAxios.post).last();
        assert.equal(url, "https://host.com/credentials/store/system/domain/_/createCredentials");
        assert.equal(body.json, "{\"a\":1}");
        assert.equal(config.headers["Content-Type"], "application/x-www-form-urlencoded;charset=UTF-8");

    });

    it("with custom credentials folder should send through correct parameters to genericJenkinsPost", async () => {

        const mockedAxios: AwaitAxios = mock(AwaitAxios);
        const axiosInstance = instance(mockedAxios);

        const service = new JenkinsService(axiosInstance);

        await service.createCredentials(
            "host.com",
            "1",
            {a: 1},
            {
                domain: "Custom",
                jobName: "Some Job",
            });

        const [url, body, config] = capture(mockedAxios.post).last();
        assert.equal(url, "https://host.com/job/Some Job/credentials/store/folder/domain/Custom/createCredentials");
        assert.equal(body.json, "{\"a\":1}");
        assert.equal(config.headers["Content-Type"], "application/x-www-form-urlencoded;charset=UTF-8");

    });
});

describe("JenkinsService getProjectCredentialsDomain", () => {

    it("should return correctly formatted name", async () => {

        const service = new JenkinsService();

        const projectCredentialsDomain = service.getProjectCredentialsDomain("Project");

        assert.equal(projectCredentialsDomain, "Project Credentials");
    });
});
