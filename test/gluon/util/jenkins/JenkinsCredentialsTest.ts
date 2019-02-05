import assert = require("power-assert");
import {getOpenshiftEnvironmentCredential} from "../../../../src/gluon/util/jenkins/JenkinsCredentials";
import {OpenShiftProjectNamespace} from "../../../../src/gluon/util/project/Project";

describe("JenkinsCredentials getOpenshiftEnvironmentCredential", () => {

    it("should return correct credentials type", async () => {

        const environment: OpenShiftProjectNamespace = {
            postfix: "PreProd",
            displayName: "Pre Production",
            namespace: "default-abc-pre-prod",
        };

        const credential = getOpenshiftEnvironmentCredential(environment);

        assert.equal(credential.credentials.id, "pre-prod-project");
        assert.equal(credential.credentials.secret, "default-abc-pre-prod");
        assert.equal(credential.credentials.description, "Pre Production OpenShift project Id");
        assert.equal(credential.credentials.$class, "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl");
    });
});
