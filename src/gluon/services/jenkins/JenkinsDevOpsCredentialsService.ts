import {logger} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {
    getJenkinsBitbucketProjectCredential,
    getJenkinsDockerCredential,
    getJenkinsMavenCredential,
    getJenkinsNexusCredential,
    getJenkinsSubatomicSharedResourceNamespaceCredentials,
    JenkinsCredentials,
} from "../../util/jenkins/JenkinsCredentials";
import {QMError} from "../../util/shared/Error";
import {JenkinsService} from "./JenkinsService";

export class JenkinsDevOpsCredentialsService {

    constructor(private jenkinsService: JenkinsService = new JenkinsService()) {
    }

    public async createDevOpsJenkinsGlobalCredentials(
        projectId: string,
        jenkinsHost: string,
        token: string,
        openShiftCloud: string,
        createMethod: JenkinsCredentialsAction = JenkinsCredentialsAction.CREATE) {
        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add credentials`);
        const bitbucketCredentials = getJenkinsBitbucketProjectCredential(projectId);

        await this.recreateGlobalCredentialsFor("Bitbucket", jenkinsHost, token, bitbucketCredentials, createMethod);

        const nexusCredentials = getJenkinsNexusCredential();

        await this.recreateGlobalCredentialsFor("Nexus", jenkinsHost, token, nexusCredentials, createMethod);

        const dockerRegistryCredentials = getJenkinsDockerCredential(openShiftCloud);

        await this.recreateGlobalCredentialsFor("Docker", jenkinsHost, token, dockerRegistryCredentials, createMethod);

        const sharedResourceNamespaceCredentials = getJenkinsSubatomicSharedResourceNamespaceCredentials(openShiftCloud);

        await this.recreateGlobalCredentialsFor("Shared Resource Namespace", jenkinsHost, token, sharedResourceNamespaceCredentials, createMethod);

        const mavenCredentials = getJenkinsMavenCredential();

        await this.recreateGlobalCredentialsFor("Maven", jenkinsHost, token, mavenCredentials, createMethod, {
            filePath: QMConfig.subatomic.maven.settingsPath,
            fileName: "settings.xml",
        });
    }

    public async createDevOpsJenkinsGlobalCredentialsFromList(
        projectId: string,
        jenkinsHost: string,
        token: string,
        jenkinsCredentials: JenkinsCredentials[],
        createMethod: JenkinsCredentialsAction = JenkinsCredentialsAction.CREATE) {
        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add credentials`);

        for (const credential of jenkinsCredentials) {
            await this.recreateGlobalCredentialsFor(credential.credentials.id, jenkinsHost, token, credential, createMethod);
        }
    }

    private async recreateGlobalCredentialsFor(
        forName: string,
        jenkinsHost: string,
        token: string,
        credentials: JenkinsCredentials,
        createMethod: JenkinsCredentialsAction,
        fileDetails: { fileName: string, filePath: string } = null) {
        try {
            if (createMethod === JenkinsCredentialsAction.RECREATE) {
                await this.jenkinsService.deleteCredential(jenkinsHost, token, credentials.credentials.id);
            }
            await this.jenkinsService.createJenkinsCredentialsWithRetries(6, 5000, jenkinsHost, token, credentials, fileDetails);
        } catch (error) {
            throw new QMError(`Failed to create ${forName} Global Credentials in Jenkins`);
        }
    }
}

export enum JenkinsCredentialsAction {
    CREATE,
    RECREATE,
}
