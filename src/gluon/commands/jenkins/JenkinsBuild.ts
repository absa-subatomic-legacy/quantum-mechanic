import {
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import * as _ from "lodash";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {
    GluonApplicationNameParam,
    GluonApplicationNameSetter,
    GluonProjectNameParam,
    GluonProjectNameSetter,
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTeamOpenShiftCloudParam,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Kick off a Jenkins build", QMConfig.subatomic.commandPrefix + " jenkins build")
@Tags("subatomic", "jenkins", "package")
export class KickOffJenkinsBuild extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter, GluonTeamNameSetter {

    @MappedParameter(MappedParameters.SlackUser)
    public slackName: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select the team which contains the owning project of the application you would like to build",
    })
    public teamName: string;

    @GluonProjectNameParam({
        callOrder: 1,
        selectionMessage: "Please select a project which contains the application you would like to build",
    })
    public projectName: string;

    @GluonApplicationNameParam({
        callOrder: 2,
        selectionMessage: "Please select the application you would like to build",
    })
    public applicationName: string;

    @GluonTeamOpenShiftCloudParam({
        callOrder: 3,
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
            const result = await this.applicationsForGluonProject(ctx, this.applicationName, this.teamName, this.projectName);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async applicationsForGluonProject(ctx: HandlerContext,
                                              gluonApplicationName: string,
                                              gluonTeamName: string,
                                              gluonProjectName: string): Promise<HandlerResult> {
        logger.debug(`Kicking off build for application: ${gluonApplicationName}`);

        const teamDevOpsProjectId = `${_.kebabCase(gluonTeamName).toLowerCase()}-devops`;
        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);

        const jenkinsHost = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.debug(`Using Jenkins Route host [${jenkinsHost.output}] to kick off build`);

        const kickOffBuildResult = await this.jenkinsService.kickOffBuild(
            jenkinsHost.output,
            token,
            gluonProjectName,
            gluonApplicationName,
        );
        if (isSuccessCode(kickOffBuildResult.status)) {
            return await ctx.messageClient.respond({
                text: `🚀 *${gluonApplicationName}* is being built...`,
            });
        } else {
            if (kickOffBuildResult.status === 404) {
                logger.warn(`This is probably the first build and therefore a master branch job does not exist`);
                await this.jenkinsService.kickOffFirstBuild(
                    jenkinsHost.output,
                    token,
                    gluonProjectName,
                    gluonApplicationName,
                );
                return await ctx.messageClient.respond({
                    text: `🚀 *${gluonApplicationName}* is being built for the first time...`,
                });
            } else {
                logger.error(`Failed to kick off JenkinsBuild. Error: ${JSON.stringify(kickOffBuildResult)}`);
                throw new QMError("Failed to kick off jenkins build. Network failure connecting to Jenkins instance.");
            }
        }
    }
}
