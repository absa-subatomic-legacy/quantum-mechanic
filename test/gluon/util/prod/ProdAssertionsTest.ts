import assert = require("power-assert");
import {instance, mock, when} from "ts-mockito";
import {GluonProdService} from "../../../../src/gluon/services/gluon/GluonProdService";
import {GluonService} from "../../../../src/gluon/services/gluon/GluonService";
import {ProjectProdRequestService} from "../../../../src/gluon/services/gluon/ProjectProdRequestService";
import {ProjectService} from "../../../../src/gluon/services/gluon/ProjectService";
import {assertProjectProductionIsApproved} from "../../../../src/gluon/util/prod/ProdAssertions";
import {QMError} from "../../../../src/gluon/util/shared/Error";

describe("assertProjectProductionIsApproved", () => {
    it("with production approval should not throw QMError", async () => {

        const mockedProdProjectService = mock(ProjectProdRequestService);
        when(mockedProdProjectService.assertProjectProdIsApproved("1", "12345")).thenReturn();

        const mockedProjectService = mock(ProjectService);
        when(mockedProjectService.gluonProjectFromProjectName("Test")).thenReturn(Promise.resolve({
            projectId: "1",
        }));

        const gluonProdService: GluonProdService = new GluonProdService(
            undefined,
            instance(mockedProdProjectService),
        );

        const gluonService: GluonService = new GluonService(
            undefined,
            undefined,
            undefined,
            undefined,
            instance(mockedProjectService),
            undefined,
            gluonProdService,
        );

        assert.doesNotThrow(async () => {
                await assertProjectProductionIsApproved("Test", "12345", "Failure!", gluonService);
            },
        );
    });

    it("with no production approval should throw QMError", async () => {

        const mockedProdProjectService = mock(ProjectProdRequestService);
        when(mockedProdProjectService.assertProjectProdIsApproved("1", "12345"))
            .thenThrow(new QMError("Not approved"));

        const mockedProjectService = mock(ProjectService);
        when(mockedProjectService.gluonProjectFromProjectName("Test")).thenReturn(Promise.resolve({
            projectId: "1",
        }));

        const gluonProdService: GluonProdService = new GluonProdService(
            undefined,
            instance(mockedProdProjectService),
        );

        const gluonService: GluonService = new GluonService(
            undefined,
            undefined,
            undefined,
            undefined,
            instance(mockedProjectService),
            undefined,
            gluonProdService,
        );
        let thrownError: QMError;
        try {
            await assertProjectProductionIsApproved("Test", "12345", "Failure!", gluonService);
        } catch (error) {
            thrownError = error;
        }

        assert(thrownError instanceof QMError);
        assert.equal(thrownError.getSlackMessage().text, "Failure!");
        assert(thrownError.getSlackMessage().attachments[0].text.startsWith("To move your applications into prod"));
        assert.equal(thrownError.getSlackMessage().attachments[0].actions[0].text, "Create Prod Request");
    });
});
