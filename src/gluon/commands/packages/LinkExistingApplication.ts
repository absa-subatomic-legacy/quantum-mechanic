import {
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
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
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";

@CommandHandler("Link an existing application", QMConfig.subatomic.commandPrefix + " link application")
@Tags("subatomic", "package", "project")
export class LinkExistingApplication extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, BitbucketRepoSetter {

    @Parameter({
        description: "application name",
    })
    public name: string;

    @Parameter({
        description: "application description",
    })
    public description: string;

    @GluonTeamNameParam({
        callOrder: 0,
        forceSet: false,
        selectionMessage: "Please select a team, whose project you would like to link an application to",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select a project to which you would like to link an application to",
    })
    public projectName: string;

    @BitbucketRepositoryParam({
        callOrder: 2,
        selectionMessage: "Please select the Bitbucket repository which contains the application you want to link",
    })
    public bitbucketRepositorySlug: string;

    constructor(public gluonService = new GluonService(),
                public bitbucketService = new BitbucketService(),
                private packageCommandService = new PackageCommandService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {

        logger.debug(`Linking to Gluon project: ${this.projectName}`);

        try {
            await ctx.messageClient.respond({
                text: "🚀 Your new application is being created...",
            });

            const result = await this.packageCommandService.linkBitbucketRepoToGluonPackage(
                this.screenName,
                this.name,
                this.description,
                this.bitbucketRepositorySlug,
                this.projectName,
                ApplicationType.DEPLOYABLE,
            );
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

}
