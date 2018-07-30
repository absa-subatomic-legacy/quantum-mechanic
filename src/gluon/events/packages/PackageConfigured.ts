import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import {BitBucketServerRepoRef} from "@atomist/automation-client/operations/common/BitBucketServerRepoRef";
import {GitCommandGitProject} from "@atomist/automation-client/project/git/GitCommandGitProject";
import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {QMTemplate} from "../../../template/QMTemplate";
import {KickOffJenkinsBuild} from "../../commands/jenkins/JenkinsBuild";
import {JenkinsService} from "../../services/jenkins/JenkinsService";
import {OCService} from "../../services/openshift/OCService";
import {ApplicationType} from "../../util/packages/Applications";
import {QMError} from "../../util/shared/Error";
import {isSuccessCode} from "../../util/shared/Http";
import {getDevOpsEnvironmentDetails} from "../../util/team/Teams";

@EventHandler("Receive PackageConfiguredEvent events", `
subscription PackageConfiguredEvent {
  PackageConfiguredEvent {
    id
    application {
      applicationId
      name
      description
      applicationType
    }
    project {
      projectId
      name
      description
    }
    bitbucketRepository {
      bitbucketId
      name
      repoUrl
      remoteUrl
    }
    bitbucketProject {
      id
      key
      name
      description
      url
    }
    owningTeam {
      teamId
      name
      slackIdentity {
        teamChannel
      }
    }
    buildDetails{
        buildType
        jenkinsDetails{
            jenkinsFile
        }
    }
  }
}
`)
export class PackageConfigured implements HandleEvent<any> {

    private readonly JENKINSFILE_EXTENSION = ".groovy";
    private readonly JENKINSFILE_FOLDER = "resources/templates/jenkins/jenkinsfile-repo/";
    private readonly JENKINSFILE_EXISTS = "JENKINS_FILE_EXISTS";

    constructor(private ocService = new OCService(), private jenkinsService = new JenkinsService()) {

    }

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested PackageConfigured event: ${JSON.stringify(event.data)}`);

        const packageConfiguredEvent = event.data.PackageConfiguredEvent[0];

        await this.addJenkinsFile(
            packageConfiguredEvent.buildDetails.jenkinsDetails.jenkinsFile,
            packageConfiguredEvent.bitbucketProject.key,
            packageConfiguredEvent.bitbucketRepository.name,
        );

        const devopsDetails = getDevOpsEnvironmentDetails(packageConfiguredEvent.owningTeam.name);

        await this.createJenkinsJob(
            devopsDetails.projectId,
            packageConfiguredEvent.project.name,
            packageConfiguredEvent.project.projectId,
            packageConfiguredEvent.application.name,
            packageConfiguredEvent.bitbucketProject.key,
            packageConfiguredEvent.bitbucketRepository.name);

        logger.info(`PackageConfigured successfully`);

        let applicationType = ApplicationType.LIBRARY;
        if (packageConfiguredEvent.application.applicationType === ApplicationType.DEPLOYABLE.toString()) {
            applicationType = ApplicationType.DEPLOYABLE;
        }

        return await this.sendPackageProvisionedMessage(
            ctx,
            packageConfiguredEvent.application.name,
            packageConfiguredEvent.project.name,
            [packageConfiguredEvent.owningTeam],
            applicationType);
    }

    private async addJenkinsFile(jenkinsfileName, bitbucketProjectKey, bitbucketRepoName): Promise<HandlerResult> {

        if (jenkinsfileName !== this.JENKINSFILE_EXISTS) {
            const username = QMConfig.subatomic.bitbucket.auth.username;
            const password = QMConfig.subatomic.bitbucket.auth.password;
            const project: GitProject = await GitCommandGitProject.cloned({
                    username,
                    password,
                },
                new BitBucketServerRepoRef(
                    QMConfig.subatomic.bitbucket.baseUrl,
                    bitbucketProjectKey,
                    bitbucketRepoName));
            try {
                await project.findFile("Jenkinsfile");
            } catch (error) {
                logger.info("Jenkinsfile doesnt exist. Adding it!");
                const jenkinsTemplate: QMTemplate = new QMTemplate(this.getPathFromJenkinsfileName(jenkinsfileName as string));
                await project.addFile("Jenkinsfile",
                    jenkinsTemplate.build({}));
            }

            const clean = await project.isClean();
            logger.debug(`Jenkinsfile has been added: ${clean.success}`);

            if (!clean.success) {
                await project.setUserConfig(
                    QMConfig.subatomic.bitbucket.auth.username,
                    QMConfig.subatomic.bitbucket.auth.email,
                );
                await project.commit(`Added Jenkinsfile`);
                await project.push();
            } else {
                logger.debug("Jenkinsfile already exists");
            }
        }

        return await success();
    }

    private getPathFromJenkinsfileName(jenkinsfileName: string): string {
        return this.JENKINSFILE_FOLDER + jenkinsfileName + this.JENKINSFILE_EXTENSION;
    }

    private async createJenkinsJob(teamDevOpsProjectId: string,
                                   gluonProjectName: string,
                                   gluonProjectId: string,
                                   gluonApplicationName: string,
                                   bitbucketProjectKey: string,
                                   bitbucketRepositoryName: string): Promise<HandlerResult> {
        const token = await this.ocService.getServiceAccountToken("subatomic-jenkins", teamDevOpsProjectId);
        const jenkinsHost = await this.ocService.getJenkinsHost(teamDevOpsProjectId);
        logger.debug(`Using Jenkins Route host [${jenkinsHost.output}] to add Bitbucket credentials`);

        const jenkinsTemplate: QMTemplate = new QMTemplate("resources/templates/jenkins/jenkins-multi-branch-project.xml");
        const builtTemplate: string = jenkinsTemplate.build(
            {
                gluonApplicationName,
                gluonBaseUrl: QMConfig.subatomic.gluon.baseUrl,
                gluonProjectId,
                bitbucketBaseUrl: QMConfig.subatomic.bitbucket.baseUrl,
                teamDevOpsProjectId,
                bitbucketProjectKey,
                bitbucketRepositoryName,
            },
        );

        const createJenkinsJobResponse = await this.jenkinsService.createJenkinsJob(
            jenkinsHost.output,
            token.output,
            gluonProjectName,
            gluonApplicationName,
            builtTemplate);

        if (!isSuccessCode(createJenkinsJobResponse.status)) {
            if (createJenkinsJobResponse.status === 400) {
                logger.warn(`Multibranch job for [${gluonApplicationName}] probably already created`);
            } else {
                logger.error(`Unable to create jenkinsJob`);
                throw new QMError("Failed to create jenkins job. Network request failed.");
            }
        }
        return await success();
    }

    private async sendPackageProvisionedMessage(ctx: HandlerContext, applicationName: string, projectName: string, associatedTeams: any[], applicationType: ApplicationType) {
        let packageTypeString = "application";
        if (applicationType === ApplicationType.LIBRARY) {
            packageTypeString = "library";
        }

        return await ctx.messageClient.addressChannels({
            text: `Your ${packageTypeString} *${applicationName}*, in project *${projectName}*, has been provisioned successfully ` +
            "and is ready to build/deploy",
            attachments: [{
                fallback: `Your ${packageTypeString} has been provisioned successfully`,
                footer: `For more information, please read the ${this.docs() + "#jenkins-build"}`,
                text: `
You can kick off the build pipeline for your ${packageTypeString} by clicking the button below or pushing changes to your ${packageTypeString}'s repository`,
                mrkdwn_in: ["text"],
                actions: [
                    buttonForCommand(
                        {
                            text: "Start build",
                            style: "primary",
                        },
                        new KickOffJenkinsBuild(),
                        {
                            projectName,
                            applicationName,
                        }),
                ],
            }],
        }, associatedTeams.map(team =>
            team.slackIdentity.teamChannel));
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference`,
            "documentation")}`;
    }
}
