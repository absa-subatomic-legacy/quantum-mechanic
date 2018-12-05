import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {
    addressSlackChannelsFromContext,
    menuForCommand,
} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import {Attachment} from "@atomist/slack-messages/SlackMessages";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {getProjectId, QMProject} from "../../util/project/Project";
import {QMColours} from "../../util/QMColour";
import {
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter, GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {QMTenant} from "../../util/shared/Tenants";

@CommandHandler("Create a new OpenShift Persistent Volume Claim", QMConfig.subatomic.commandPrefix + " create openshift pvc")
@Tags("subatomic", "project", "other")
export class CreateOpenShiftPvc extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: `Please select a team associated with the project you wish to create a PVC for`,
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    @GluonProjectNameParam({
        callOrder: 2,
        selectionMessage: `Please select the project, whose OpenShift environments the PVCs will be created in`,
    })
    public projectName: string;

    @RecursiveParameter({
        callOrder: 3,
        selectionMessage: "Please select the project environment(s) to create the PVCs in",
        setter: setProjectForPvc,
    })
    public openShiftProjectNames: string;

    @Parameter({
        description: "a name for your Persistent Volume Claim",
        required: true,
    })
    public pvcName: string;

    constructor(public gluonService = new GluonService(),
                private ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {

            await this.ocService.login(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);

            const qmProject: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            const qmTenant: QMTenant = await this.gluonService.tenants.gluonTenantFromTenantId(qmProject.owningTenant);

            if (this.openShiftProjectNames === "all") {
                this.openShiftProjectNames = "";
                for (const environment of QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd.defaultEnvironments) {
                    this.openShiftProjectNames += getProjectId(qmTenant.name, qmProject.name, environment.id) + ",";
                }
                this.openShiftProjectNames.substr(0, this.openShiftProjectNames.length - 1);
            }

            const pvcName = _.kebabCase(this.pvcName).toLowerCase();
            const pvcAttachments: Attachment[] = [];

            for (const environment of this.openShiftProjectNames.split(",")) {
                logger.debug(`Adding PVC to OpenShift project: ${environment}`);
                await this.ocService.createPVC(pvcName, environment);
                pvcAttachments.push({
                    fallback: `PVC created`,
                    text: `
*${pvcName}* PVC successfully created in *${environment}*`,
                    mrkdwn_in: ["text"],
                    title_link: `${QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd.masterUrl}/console/project/${environment}/browse/persistentvolumeclaims/${pvcName}`,
                    title: `${environment}`,
                    color: QMColours.stdGreenyMcAppleStroodle.hex,
                });
            }

            const result = await this.sendPvcResultMessage(ctx, pvcAttachments);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async sendPvcResultMessage(ctx: HandlerContext, pvcAttachments: any[]): Promise<HandlerResult> {
        const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
        const msg: SlackMessage = {
            text: `Your Persistent Volume Claims have been processed...`,
            attachments: pvcAttachments.concat({
                fallback: `Using PVCs`,
                text: `
Now that your PVCs have been created, you can add this PVC as storage to an application. Follow the Subatomic documentation for more details on how to add storage.`,
                color: QMColours.stdShySkyBlue.hex,
                mrkdwn_in: ["text"],
                thumb_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/OpenShift-LogoType.svg/959px-OpenShift-LogoType.svg.png",
                footer: `For more information, please read the ${this.docs()}`,
            } as Attachment),
        };

        return await ctx.messageClient.send(msg, destination);
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/storage`,
            "documentation")}`;
    }

}

async function setProjectForPvc(ctx: HandlerContext, commandHandler: CreateOpenShiftPvc, selectionMessage: string) {

    const qmProject: QMProject = await commandHandler.gluonService.projects.gluonProjectFromProjectName(commandHandler.projectName);

    const qmTenant: QMTenant = await commandHandler.gluonService.tenants.gluonTenantFromTenantId(qmProject.owningTenant);

    const options = [{value: "all", text: "All environments"}];

    for (const environment of QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].openshiftNonProd.defaultEnvironments) {
        const envId = getProjectId(qmTenant.name, qmProject.name, environment.id);
        options.push(
            {
                value: envId,
                text: envId,
            },
        );
    }

    return {
        setterSuccess: false,
        messagePrompt: {
            text: selectionMessage,
            fallback: "Please select a project",
            actions: [
                menuForCommand(
                    {
                        text: "Select environment(s)",
                        options,
                    },
                    commandHandler, "openShiftProjectNames",
                    {
                        teamName: commandHandler.teamName,
                        projectName: commandHandler.projectName,
                        pvcName: commandHandler.pvcName,
                    }),
            ],
        },
    };
}
