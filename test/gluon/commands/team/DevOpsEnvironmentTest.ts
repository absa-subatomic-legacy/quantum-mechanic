import "mocha";
import assert = require("power-assert");
import {QMConfig} from "../../../../src/config/QMConfig";
import {NewDevOpsEnvironment} from "../../../../src/gluon/commands/team/DevOpsEnvironment";
import {TestQMContext} from "../../TestQMContext";

const nock = require("nock");

describe("NewDevOpsEnvironment command", () => {
    it("should request a DevOps environment", async () => {

        const teamName = "test_name";
        const screenName = "Test.User";
        const teamChannel = "test_channel";
        const teamId = "79c41ee3-f092-4664-916f-da780195a51e";
        const memberId = "3d01d401-abb3-4eee-8884-2ed5a472172d";

        const gluon = nock(QMConfig.subatomic.gluon.baseUrl)
            .get(`/teams?name=${teamName}`)
            .reply(200, {
                _embedded: {
                    teamResources: [
                        {
                            teamId: `${teamId}`,
                        },
                    ],
                },
            })
            .get(`/members?slackScreenName=${screenName}`)
            .reply(200, {
                _embedded: {
                    teamMemberResources: [
                        {
                            memberId: `${memberId}`,
                        },
                    ],
                },
            })
            .put(`/teams/${teamId}`,
                {
                    devOpsEnvironment: {
                        requestedBy: memberId,
                    },
                }).reply(200);

        const command: NewDevOpsEnvironment = new NewDevOpsEnvironment();

        command.teamName = teamName;
        command.teamChannel = teamChannel;
        command.screenName = screenName;

        const context = new TestQMContext();

        await command.runQMCommand(context);

        gluon.isDone();

        assert.equal(context.messageClient.channelMessagesSent[0].message.text, `Requesting DevOps environment for *${teamName}* team.`);
    });
});
