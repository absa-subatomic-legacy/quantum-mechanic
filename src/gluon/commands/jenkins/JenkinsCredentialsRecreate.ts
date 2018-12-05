import {
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {OpenshiftResource} from "../../../openshift/api/resources/OpenshiftResource";
import {GluonService} from "../../services/gluon/GluonService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {getJenkinsBitbucketAccessCredentialXML} from "../../util/jenkins/JenkinsCredentials";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter, GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";

@CommandHandler("Recreate the Jenkins Bitbucket Credentials", QMConfig.subatomic.commandPrefix + " create jenkins bitbucket credentials")
@Tags("subatomic", "bitbucket", "jenkins")
export class JenkinsCredentialsRecreate extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackUser)
    public slackName: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select the team which contains the owning project of the jenkins you would like to reconfigure",
    })
    public teamName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 1,
    })
    public openShiftCloud: string;

    constructor(public gluonService = new GluonService(),
                private jenkinsService = new JenkinsService(),
                private ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            await this.ocService.login(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);
            const result = await this.recreateBitbucketJenkinsCredential(ctx, this.teamName);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async recreateBitbucketJenkinsCredential(ctx: HandlerContext,
                                                     gluonTeamName: string): Promise<HandlerResult> {

        const teamDevOpsProjectId = getDevOpsEnvironmentDetails(gluonTeamName).openshiftProjectId;
        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);

        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to kick off build`);

        const kickOffBuildResult = await this.jenkinsService.updateGlobalCredential(
            jenkinsHost,
            token,
            getJenkinsBitbucketAccessCredentialXML(teamDevOpsProjectId),
            `${teamDevOpsProjectId}-bitbucket`,
        );
        if (!isSuccessCode(kickOffBuildResult.status)) {
            throw new QMError("Failed to recreate the Jenkins Bitbucket Credential! Please ensure your Jenkins is running.");
        }
        return await ctx.messageClient.respond({
            text: `🚀 Successfully created the Jenkins Bitbucket Credentials for *${gluonTeamName}* DevOps.`,
        });
    }
}
