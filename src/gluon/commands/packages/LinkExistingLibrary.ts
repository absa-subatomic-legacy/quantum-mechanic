import {
    HandlerContext,
    HandlerResult,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {addressSlackChannelsFromContext} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {ResponderMessageClient} from "../../../context/QMMessageClient";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {GluonService} from "../../services/gluon/GluonService";
import {PackageCommandService} from "../../services/packages/PackageCommandService";
import {ApplicationType} from "../../util/packages/Applications";
import {
    BitbucketRepoSetter,
    BitbucketRepositoryParam,
} from "../../util/recursiveparam/BitbucketParamSetters";
import {
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError} from "../../util/shared/Error";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Link an existing library", atomistIntent(CommandIntent.LinkExistingLibrary))
@Tags("subatomic", "package", "project")
export class LinkExistingLibrary extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, BitbucketRepoSetter {

    @Parameter({
        description: "library name",
    })
    public name: string;

    @Parameter({
        description: "library description",
    })
    public description: string;

    @GluonTeamNameParam({
        callOrder: 0,
        forceSet: false,
        selectionMessage: "Please select a team, whose project you would like to link a library to",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select a project to which you would like to link a library to",
    })
    public projectName: string;

    @BitbucketRepositoryParam({
        callOrder: 2,
        selectionMessage: "Please select the Bitbucket repository which contains the library you want to link",
    })
    public bitbucketRepositorySlug: string;

    constructor(public gluonService = new GluonService(),
                public bitbucketService = new BitbucketService(),
                private packageCommandService = new PackageCommandService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            const destination = await addressSlackChannelsFromContext(ctx, this.teamChannel);
            await ctx.messageClient.send({
                text: "🚀 Your new library is being created...",
            }, destination);

            const result = await this.packageCommandService.linkBitbucketRepoToGluonPackage(
                this.slackUserId,
                this.name,
                this.description,
                this.bitbucketRepositorySlug,
                this.projectName,
                ApplicationType.LIBRARY,
            );
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }
}
