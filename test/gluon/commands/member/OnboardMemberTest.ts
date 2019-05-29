import assert = require("power-assert");
import {QMConfig} from "../../../../src/config/QMConfig";
import {OnboardMember} from "../../../../src/gluon/commands/member/OnboardMember";
import {TestQMContext} from "../../TestQMContext";

const nock = require("nock");

describe("Onboard new member test", () => {

    it("should welcome new user (no secondary channels)", async () => {

        const command: OnboardMember = new OnboardMember();
        command.teamId = "1234";
        command.domainUsername = "domain/username";
        command.email = "tester@gmail.com";
        command.firstName = "Peter";
        command.lastName = "BillyBob";
        command.screenName = "p.b";
        command.teamChannel = "something";

        const gluon = nock(QMConfig.subatomic.gluon.baseUrl)
            .post("/members")
            .reply(200, {});

        const context: TestQMContext = new TestQMContext();

        await command.handleQMCommand(context);

        gluon.isDone();

        assert.equal(context.messageClient.responseMessagesSent[0].text, "🚀 Welcome to the Subatomic environment *Peter*!\n\nYou have been added to the Subatomic community channel/s:\n *sub-discussion*\n\nNext steps are to either join an existing team or create a new one.");
    });
});
