import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {
    CommandHandler,
    MappedParameter,
    MappedParameters,
    Parameter,
    Tags,
} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {AtomistQMContext, QMContext} from "../../../context/QMContext";
import {
    ResponderMessageClient,
    SimpleQMMessageClient,
} from "../../../context/QMMessageClient";
import {isSuccessCode} from "../../../http/Http";
import {OnboardMemberMessages} from "../../messages/member/OnboardMemberMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {OnboardMemberService} from "../../services/member/OnboardMemberService";
import {QMParamValidation} from "../../util/QMParamValidation";
import {BaseQMComand} from "../../util/shared/BaseQMCommand";
import {handleQMError, QMError} from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Onboard a new team member", atomistIntent(CommandIntent.OnboardMember))
@Tags("subatomic", "slack", "member")
export class OnboardMember extends BaseQMComand {
    @MappedParameter(MappedParameters.SlackTeam)
    public teamId: string;

    @MappedParameter(MappedParameters.SlackUser)
    public userId: string;

    @Parameter({
        displayName: "first name",
        description: "your first name",
    })
    public firstName: string;

    @Parameter({
        description: "your last name",
    })
    public lastName: string;

    @Parameter({
        description: "your email address",
        pattern: QMParamValidation.getPattern("OnboardMember", "email", "[^@]+@[^\\.]+\\..+"),
    })
    public email: string;

    @Parameter({
        description: "your username including domain",
        validInput: "domain username in the following format: domain\\username (all lowercase)",
        pattern: QMParamValidation.getPattern("OnboardMember", "domainUsername", "^[a-z0-9\\\\._-]{7,}$"),
    })
    public domainUsername: string;

    public onboardMessages: OnboardMemberMessages = new OnboardMemberMessages();

    constructor(private gluonService = new GluonService(),
                private onboardMemberService = new OnboardMemberService()) {
        super();
    }

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            logger.info("Requesting new Gluon user");
            return await this.handleQMCommand(new AtomistQMContext(ctx));
        } catch (error) {
            this.failCommand();
            return await this.handleError(new ResponderMessageClient(ctx), error);
        }
    }

    public async handleQMCommand(ctx: QMContext): Promise<HandlerResult> {
        await this.createGluonTeamMember(
            {
                firstName: this.firstName,
                lastName: this.lastName,
                email: this.email,
                domainUsername: this.domainUsername,
                slack: {
                    screenName: this.screenName,
                    userId: this.userId,
                },
            });

        const secondaryChannelsInvited = await this.inviteMembersToSecondarySlackChannels(ctx);

        const message = this.onboardMessages.presentTeamCreationAndApplicationOptions(this.firstName, secondaryChannelsInvited);
        const result = await ctx.messageClient.respond(message);

        this.succeedCommand();
        return result;

    }

    private async inviteMembersToSecondarySlackChannels(ctx: QMContext): Promise<string[]> {

        const secondaryChannelsInvited: string[] = [];

        for (const channel of QMConfig.secondarySlackChannels) {
            try {
                await this.onboardMemberService.inviteUserToSecondarySlackChannel(ctx, this.teamId, this.firstName, channel, this.userId, this.screenName);
                secondaryChannelsInvited.push(channel);
            } catch (error) {
                await this.handleError(ctx.messageClient.createResponderMessageClient(), error);
            }
        }

        return secondaryChannelsInvited;
    }

    private async createGluonTeamMember(teamMemberDetails: any) {

        const createMemberResult = await this.gluonService.members.createGluonMember(teamMemberDetails);

        if (createMemberResult.status === 409) {
            logger.error(`Failed to onboard a member since the details of the user are already in use.`);
            throw new QMError(`Failed to onboard since the member's details are already in use. Please retry using different values.`);
        } else if (!isSuccessCode(createMemberResult.status)) {
            throw new QMError(`Unable to onboard a member with provided details. Unknown error.`);
        }
    }

    private async handleError(messageClient: SimpleQMMessageClient, error) {
        return await handleQMError(messageClient, error);
    }
}
