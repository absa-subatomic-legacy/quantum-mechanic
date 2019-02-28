import {
    buttonForCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
    success,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {SlackMessage} from "@atomist/slack-messages";
import {v4 as uuid} from "uuid";
import {QMConfig} from "../../../config/QMConfig";
import {CommandDocumentationLink} from "../../messages/documentation/CommandDocumentationLink";
import {DocumentationUrlBuilder} from "../../messages/documentation/DocumentationUrlBuilder";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {QMMemberBase} from "../../util/member/Members";
import {QMColours} from "../../util/QMColour";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudBaseSetter,
    setGluonTeamOpenShiftCloudForced,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";
import {
    ChannelMessageClient,
    handleQMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";

@CommandHandler("Move all Openshift resources belonging to a team to a different cloud", QMConfig.subatomic.commandPrefix + " team migrate cloud")
@Tags("subatomic", "team", "other")
export class MigrateTeamCloud extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonTeamOpenShiftCloudBaseSetter {

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @RecursiveParameter({
        callOrder: 1,
        setter: setGluonTeamOpenShiftCloudForced,
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

    constructor(public gluonService = new GluonService(), public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const team: QMTeam = await this.gluonService.teams.gluonTeamByName(this.teamName);
            const qmMessageClient = new ChannelMessageClient(ctx).addDestination(team.slack.teamChannel);

            if (this.approval === ApprovalEnum.CONFIRM) {
                this.correlationId = uuid();
                const message = this.confirmMigrationRequest(this);

                return await qmMessageClient.send(message, {id: this.correlationId});
            } else if (this.approval === ApprovalEnum.APPROVED) {

                const requestingMember: QMMemberBase = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

                await this.gluonService.teams.updateTeamOpenShiftCloud(team.teamId, this.openShiftCloud, requestingMember.memberId);

                this.succeedCommand();

                return success();
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
                footer: `For more information, please read the ${DocumentationUrlBuilder.commandReference(CommandDocumentationLink.MigrateTeamCloud)}.`,
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
