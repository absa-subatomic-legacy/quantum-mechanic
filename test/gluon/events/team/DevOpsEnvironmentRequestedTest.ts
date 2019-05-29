import {ClientLogging, configureLogging} from "@atomist/automation-client";
import "mocha";
import assert = require("power-assert");
import {QMConfig} from "../../../../src/config/QMConfig";
import {DevOpsEnvironmentRequested} from "../../../../src/gluon/events/team/DevOpsEnvironmentRequested";
import {TestQMContext} from "../../TestQMContext";

const nock = require("nock");

describe("DevOpsRequested event", () => {
    it("should create a devops environment and provision a jenkins", async () => {
        configureLogging(ClientLogging);
        const devOpsEnvironmentRequestedEvent = {
            id: 1,
            team: {
                teamId: "1",
                name: "testing",
                slackIdentity: {
                    teamChannel: "tc",
                },
                openShiftCloud: "ab-cloud",
                owners: [{
                    firstName: "Rob",
                    domainUsername: "domain/rob",
                    slackIdentity: {
                        screenName: "rob",
                    },
                }],
                members: [],
            },
            requestedBy: {
                firstName: "Rob",
                slackIdentity: {
                    screenName: "rob",
                },
            },
        };

        const jenkinsUrl = "https://www.jenkins-test.com";

        const openshift = nock(QMConfig.subatomic.openshiftClouds["ab-cloud"].openshiftNonProd.masterUrl)
            .log(console.log)
            .post("/oapi/v1/projectrequests").reply(200) // Create project
            .get("/api/v1/namespaces/testing-devops/resourcequotas/default-quota").reply(404) // Create default quotas
            .post("/api/v1/namespaces/testing-devops/resourcequotas").reply(200)
            .get("/api/v1/namespaces/testing-devops/limitranges/default-limits").reply(404) // Create default limits
            .post("/api/v1/namespaces/testing-devops/limitranges").reply(200)
            .get("/oapi/v1/namespaces/testing-devops/rolebindings").reply(200, {items: []}) // Add user permissions to devops
            .post("/oapi/v1/namespaces/testing-devops/rolebindings").reply(200)
            .get("/oapi/v1/namespaces/subatomic/rolebindings").reply(200, {items: []}) // Add user permissions to shared resources space
            .post("/oapi/v1/namespaces/subatomic/rolebindings").reply(200)
            .get("/api/v1/namespaces/testing-devops/secrets/bitbucket-ssh").reply(200) // Avoid trying to mock secret creation
            .get("/oapi/v1/namespaces/subatomic/templates/jenkins-persistent-subatomic").reply(200, {parameters: []}) // Process and deploy the jenkins template
            .post("/oapi/v1/namespaces/subatomic/processedtemplates").reply(200, {objects: []})
            .get("/oapi/v1/namespaces/subatomic/rolebindings").reply(200, {items: []}) // Give jenkins sa permissions in shared resource space
            .post("/oapi/v1/namespaces/subatomic/rolebindings").reply(200)
            .get("/api/v1/namespaces/testing-devops/serviceaccounts/subatomic-jenkins").reply(400) // Give jenkins sa permissions in devops
            .post("/api/v1/namespaces/testing-devops/serviceaccounts").reply(200)
            .get("/oapi/v1/namespaces/testing-devops/rolebindings/subatomic-jenkins-edit").reply(400)
            .post("/oapi/v1/namespaces/testing-devops/rolebindings").reply(200)
            .get("/oapi/v1/namespaces/testing-devops/deploymentconfigs/jenkins/status").reply(200, { // Rollout Jenkins
                spec: {replicas: 1},
                status: {availableReplicas: 1},
            })
            .get("/oapi/v1/namespaces/testing-devops/routes/jenkins").reply(200, { // Get jenkins host
                kind: "Route",
                metadata: {name: "jenkins", annotations: []},
                spec: {host: jenkinsUrl},
            })
            .patch("/oapi/v1/namespaces/testing-devops/routes/jenkins").reply(200) // Add annotations to jenkins host
            .get("/oapi/v1/namespaces/testing-devops/routes/jenkins").reply(200, { // Get jenkins host
                kind: "Route",
                metadata: {name: "jenkins", annotations: []},
                spec: {host: "www.jenkins-test.com"},
            })
            .get("/api/v1/namespaces/testing-devops/serviceaccounts/subatomic-jenkins").reply(200, { // Get the service account token to access jenkins
                secrets: [{name: "subatomic-jenkins-token"}],
            })
            .get("/api/v1/namespaces/testing-devops/secrets/subatomic-jenkins-token").reply(200, {
                data: {token: "MTIz"},
            }).get("/oapi/v1/namespaces/testing-devops/routes/jenkins").reply(200, { // Get jenkins host
                kind: "Route",
                metadata: {name: "jenkins", annotations: []},
                spec: {host: "www.jenkins-test.com"},
            });

        const jenkins = nock(jenkinsUrl)
            .log(console.log)
            .post("/credentials/store/system/domain/_/createCredentials").reply(200) // Mock all credential creations
            .post("/credentials/store/system/domain/_/createCredentials").reply(200)
            .post("/credentials/store/system/domain/_/createCredentials").reply(200)
            .post("/credentials/store/system/domain/_/createCredentials").reply(200)
            .post("/credentials/store/system/domain/_/createCredentials").reply(200);

        const event: DevOpsEnvironmentRequested = new DevOpsEnvironmentRequested();

        const context = new TestQMContext();

        await event.handleQMEvent(devOpsEnvironmentRequestedEvent, context);

        openshift.isDone();
        jenkins.isDone();

        assert.equal(context.messageClient.channelMessagesSent.pop().message.text, "Your Jenkins instance has been successfully provisioned in the DevOps environment: <https://www.jenkins-test.com>");
        assert.equal(context.eventsRaised[0].eventName, "DevOpsEnvironmentProvisionedEvent");
    });
});
