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
import {GluonService} from "../../services/gluon/GluonService";
import {
    JenkinsCredentialsAction,
    JenkinsDevOpsCredentialsService,
} from "../../services/jenkins/JenkinsDevOpsCredentialsService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {handleQMError, ResponderMessageClient} from "../../util/shared/Error";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {atomistIntent, CommandIntent} from "../CommandIntent";

@CommandHandler("Recreate the Jenkins Bitbucket Credentials", atomistIntent(CommandIntent.JenkinsCredentialsRecreate))
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
                private ocService = new OCService(),
                private jenkinsDevOpsCredentialsService = new JenkinsDevOpsCredentialsService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[this.openShiftCloud].openshiftNonProd);
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

        const team: QMTeam = await this.gluonService.teams.gluonTeamByName(gluonTeamName);

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to kick off build`);

        await this.jenkinsDevOpsCredentialsService.createDevOpsJenkinsGlobalCredentials(teamDevOpsProjectId, jenkinsHost, token, team.openShiftCloud, JenkinsCredentialsAction.CREATE);

        return await ctx.messageClient.respond({
            text: `🚀 Successfully created the Jenkins Bitbucket Credentials for *${gluonTeamName}* DevOps.`,
        });
    }
}
