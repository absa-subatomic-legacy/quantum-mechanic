import {
    buttonForCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {SlackMessage} from "@atomist/slack-messages";
import {
    ChannelMessageClient,
    ResponderMessageClient,
} from "../../../context/QMMessageClient";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {QMColours} from "../../util/QMColour";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudBaseSetter,
    setGluonTeamOpenShiftCloud,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";
import {handleQMError} from "../../util/shared/Error";
import {QMMemberBase} from "../../util/transform/types/gluon/Member";
import {QMTeam} from "../../util/transform/types/gluon/Team";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Move all Openshift resources belonging to a team to a different cloud", atomistIntent(CommandIntent.MigrateTeamCloud))
@Tags("subatomic", "team", "other")
export class MigrateTeamCloud extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonTeamOpenShiftCloudBaseSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for.",
    })
    public teamName: string;

    @RecursiveParameter({
        callOrder: 1,
        setter: setGluonTeamOpenShiftCloud,
        selectionMessage: "Please select an OpenShift cloud to migrate to.",
    })
    public openShiftCloud: string;

    @Parameter({
        required: false,
        displayable: false,
    })
    public approval: ApprovalEnum = ApprovalEnum.TO_CONFIRM;

    @Parameter({
        required: false,
        displayable: false,
    })
    public correlationId: string;

    constructor(public gluonService = new GluonService(), public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const team: QMTeam = await this.gluonService.teams.getTeamByName(this.teamName);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            if (this.approval === ApprovalEnum.TO_CONFIRM) {
                this.correlationId = ctx.correlationId;
                const message = this.confirmMigrationRequest(this);

                return await qmMessageClient.send(message, {id: this.correlationId});
            } else if (this.approval === ApprovalEnum.APPROVED) {

                const requestingMember: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);
                await this.gluonService.teams.updateTeamOpenShiftCloud(team.teamId, this.openShiftCloud, requestingMember.memberId);

                this.succeedCommand();

                return await qmMessageClient.send(this.getConfirmationResultMessage(this.approval), {id: this.correlationId});
            } else if (this.approval === ApprovalEnum.REJECTED) {

                return await qmMessageClient.send(this.getConfirmationResultMessage(this.approval), {id: this.correlationId});
            }

        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private getConfirmationResultMessage(result: ApprovalEnum) {
        const message = {
            text: `*Migration request status:*`,
            attachments: [],
        };

        if (result === ApprovalEnum.APPROVED) {
            message.attachments.push({
                text: `*Confirmed*`,
                fallback: "*Confirmed*",
                color: QMColours.stdGreenyMcAppleStroodle.hex,
            });
        } else if (result === ApprovalEnum.REJECTED) {
            message.attachments.push({
                text: `*Cancelled*`,
                fallback: "*Cancelled*",
                color: QMColours.stdReddyMcRedFace.hex,
            });
        }

        return message;
    }

    private confirmMigrationRequest(migrationRequestCommand: MigrateTeamCloud): SlackMessage {

        const text: string = `By clicking Approve below you confirm that you sign off on the team and all associated resources being moved to the selected cloud.`;

        return {
            text,
            attachments: [{
                fallback: "Please confirm that the above resources should be moved to Prod",
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandIntent.MigrateTeamCloud)}.`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {
                            text: "Approve Migration Request",
                            style: "primary",
                        },
                        migrationRequestCommand,
                        {
                            approval: ApprovalEnum.APPROVED,
                        }),
                    buttonForCommand(
                        {
                            text: "Cancel Migration Request",
                        },
                        migrationRequestCommand,
                        {
                            approval: ApprovalEnum.REJECTED,
                        }),
                ],
            }],
        };
    }
}
