import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {GenericProdRequestMessages} from "../../messages/project/GenericProdRequestMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {GenericOpenshiftResourceService} from "../../services/projects/GenericOpenshiftResourceService";
import {
    getHighestPreProdEnvironment,
    getResourceDisplayMessage,
} from "../../util/openshift/Helpers";
import {getProjectId, QMProject} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter, GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";
import {
    ChannelMessageClient,
    handleQMError,
    QMMessageClient,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Move openshift resources to prod", QMConfig.subatomic.commandPrefix + " request generic prod")
@Tags("subatomic", "project", "other")
export class CreateGenericProd extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 2,
    })
    public openShiftCloud: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public approval: ApprovalEnum = ApprovalEnum.CONFIRM;

    @Parameter({
        required: false,
        displayable: false,
    })
    public correlationId: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public openShiftResourcesJSON: string;

    private genericProdRequestMessages = new GenericProdRequestMessages();

    constructor(public gluonService = new GluonService(), public ocService = new OCService(), public genericOpenshiftResourceService = new GenericOpenshiftResourceService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const team = await this.gluonService.teams.gluonTeamByName(this.teamName);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            if (this.approval === ApprovalEnum.CONFIRM) {
                this.correlationId = uuid();
                const result = await this.getRequestConfirmation(qmMessageClient);
                this.succeedCommand();
                return result;
            } else if (this.approval === ApprovalEnum.APPROVED) {

                await this.createGenericProdRequest();

                const result = await qmMessageClient.send(this.getConfirmationResultMesssage(this.approval), {id: this.correlationId});
                this.succeedCommand();
                return result;
            } else if (this.approval === ApprovalEnum.REJECTED) {
                const result = await qmMessageClient.send(this.getConfirmationResultMesssage(this.approval), {id: this.correlationId});
                this.succeedCommand();
                return result;
            }

        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private getConfirmationResultMesssage(result: ApprovalEnum) {
        const message = {
            text: `*Prod request status:*`,
            attachments: [],
        };

        if (result === ApprovalEnum.APPROVED) {
            message.attachments.push({
                text: `*Confirmed*`,
                fallback: "*Confirmed*",
                color:  QMColours.stdGreenyMcAppleStroodle.hex,
            });
        } else if (result === ApprovalEnum.REJECTED) {
            message.attachments.push({
                text: `*Cancelled*`,
                fallback: "*Cancelled*",
                color:  QMColours.stdReddyMcRedFace.hex,
            });
        }

        return message;
    }

    private async getRequestConfirmation(qmMessageClient: QMMessageClient) {
        await qmMessageClient.send({
            text: "🚀 Finding available resources...",
        });

        await this.findAndListResources(qmMessageClient);

        const message = this.genericProdRequestMessages.confirmProdRequest(this);

        return await qmMessageClient.send(message, {id: this.correlationId});
    }

    private async findAndListResources(qmMessageClient: QMMessageClient) {

        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

        await this.ocService.login(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);

        const projectId = getProjectId(tenant.name, project.name, getHighestPreProdEnvironment(this.openShiftCloud).id);
        const allResources = await this.ocService.exportAllResources(projectId);

        const resources = await this.genericOpenshiftResourceService.getAllPromotableResources(
            allResources,
        );

        logger.info(resources);

        this.openShiftResourcesJSON = JSON.stringify(resources.items.map(resource => {
                return {
                    kind: resource.kind,
                    name: resource.metadata.name,
                    resourceDetails: JSON.stringify(resource),
                };
            },
        ));

        return await qmMessageClient.send({
            text: getResourceDisplayMessage(resources),
        });

    }

    private async createGenericProdRequest() {
        const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

        const actionedBy = await this.gluonService.members.gluonMemberFromScreenName(this.screenName, false);

        const openShiftResources = JSON.parse(this.openShiftResourcesJSON);

        const request = {
            project: {
                projectId: project.projectId,
            },
            actionedBy: {
                memberId: actionedBy.memberId,
            },
            openShiftResources,
        };

        logger.info(`Prod request: ${JSON.stringify(request, null, 2)}`);

        await this.gluonService.prod.generic.createGenericProdRequest(request);
    }
}
