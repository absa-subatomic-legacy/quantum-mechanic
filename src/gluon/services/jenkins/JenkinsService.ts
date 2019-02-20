import {logger} from "@atomist/automation-client";
import * as _ from "lodash";
import * as util from "util";
import {isSuccessCode} from "../../../http/Http";
import {QMError} from "../../util/shared/Error";
import {retryFunction} from "../../util/shared/RetryFunction";
import {
    gluonApplicationNameToBuildJobName,
    gluonApplicationNameToBuildViewName,
    gluonProjectNameToJobName,
} from "./GluonToJenkinsNamesConversion";
import {JenkinsNetworkHandler} from "./JenkinsNetworkHandler";

export class JenkinsService {

    private jenkinsNetworkHandler: JenkinsNetworkHandler;

    constructor() {
        this.jenkinsNetworkHandler = new JenkinsNetworkHandler();
    }

    public async kickOffFirstBuild(jenkinsHost: string,
                                   token: string,
                                   gluonProjectName: string,
                                   gluonApplicationName: string) {
        logger.debug(`Trying to kick of first jenkins build. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}; gluonApplicationName: ${gluonApplicationName} `);
        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `https://${jenkinsHost}/job/${gluonProjectNameToJobName(gluonProjectName)}/job/${gluonApplicationNameToBuildJobName(gluonApplicationName)}/build?delay=0sec`,
            "",
            token,
        );
    }

    public async kickOffBuild(jenkinsHost: string,
                              token: string,
                              gluonProjectName: string,
                              gluonApplicationName: string) {
        logger.debug(`Trying to kick of a jenkins build. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}; gluonApplicationName: ${gluonApplicationName} `);

        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `https://${jenkinsHost}/job/${gluonProjectNameToJobName(gluonProjectName)}/job/${gluonApplicationNameToBuildJobName(gluonApplicationName)}/job/master/build?delay=0sec`,
            "",
            token,
        );
    }

    public async createCredentials(jenkinsHost: string,
                                   token: string,
                                   jenkinsCredentials: any,
                                   credentialsFolder: JenkinsCredentialsFolder = {domain: "GLOBAL"}) {
        logger.debug(`Trying to create jenkins credentials. jenkinsHost: ${jenkinsHost}; token: ${token}, domain: ${credentialsFolder.domain}`);

        const jenkinsCredentialDomainUrl = this.getCredentialDomainUrl(credentialsFolder, jenkinsHost);

        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `${jenkinsCredentialDomainUrl}/createCredentials`,
            {
                json: `${JSON.stringify(jenkinsCredentials)}`,
            },
            token,
            "application/x-www-form-urlencoded;charset=UTF-8",
        );

    }

    public async updateCredential(jenkinsHost: string,
                                  token: string,
                                  jenkinsXMLCredential: string,
                                  credentialName: string,
                                  credentialsFolder: JenkinsCredentialsFolder = {domain: "GLOBAL"}) {
        logger.debug(`Trying to update jenkins global credentials. jenkinsHost: ${jenkinsHost}; token: ${token}, domain: ${credentialsFolder.domain}`);

        const jenkinsCredentialDomainUrl = this.getCredentialDomainUrl(credentialsFolder, jenkinsHost);

        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `${jenkinsCredentialDomainUrl}/credential/${credentialName}/config.xml`,
            jenkinsXMLCredential,
            token,
            "application/xml");
    }

    public async createCredentialsWithFile(jenkinsHost: string,
                                           token: string,
                                           jenkinsCredentials: any,
                                           filePath: string,
                                           fileName: string,
                                           credentialsFolder: JenkinsCredentialsFolder = {domain: "GLOBAL"}) {
        logger.debug(`Trying to create jenkins global credentials from file. jenkinsHost: ${jenkinsHost}; token: ${token}; filePath: ${filePath}; fileName: ${fileName}, domain: ${credentialsFolder.domain}`);
        const FormData = require("form-data");
        const fs = require("fs");

        const form = new FormData();
        form.append("json", JSON.stringify(jenkinsCredentials));
        form.append("file", fs.createReadStream(filePath), fileName);

        const jenkinsCredentialDomainUrl = this.getCredentialDomainUrl(credentialsFolder, jenkinsHost);

        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `${jenkinsCredentialDomainUrl}/createCredentials`,
            form,
            token,
            `multipart/form-data; boundary=${form._boundary}`,
        );
    }

    public async createJenkinsJobWithName(jenkinsHost: string, token: string, gluonProjectName: string, jenkinsJobName: string, jobConfig: string): Promise<any> {
        logger.debug(`Trying to create jenkins job. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}; gluonApplicationName: ${jenkinsJobName}`);
        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `https://${jenkinsHost}/job/${gluonProjectNameToJobName(gluonProjectName)}/createItem?name=${gluonApplicationNameToBuildJobName(jenkinsJobName)}`,
            jobConfig,
            token,
            "application/xml",
        );
    }

    public async createOpenshiftEnvironmentCredentials(jenkinsHost: string, token: string, gluonProjectName: string, credentialsConfig: string): Promise<any> {
        logger.debug(`Trying to create jenkins openshift credentials. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}`);
        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `https://${jenkinsHost}/createItem?name=${_.kebabCase(gluonProjectName).toLowerCase()}`,
            credentialsConfig,
            token,
            "application/xml",
        );
    }

    public async createJenkinsCredentialsWithRetries(retryAttempts: number, intervalTime: number, jenkinsHost: string,
                                                     token: string, jenkinsCredentials, fileDetails: { fileName: string, filePath: string } = null, credentialsFolder: JenkinsCredentialsFolder = {domain: "GLOBAL"}) {
        const maxRetries = retryAttempts;
        const waitTime = intervalTime;
        const result = await retryFunction(maxRetries, waitTime, async (attemptNumber: number) => {
            logger.warn(`Trying to create jenkins credentials. Attempt number ${attemptNumber}.`);
            try {
                let createCredentialsResult;
                if (fileDetails === null) {
                    createCredentialsResult = await this.createCredentials(jenkinsHost, token, jenkinsCredentials, credentialsFolder);
                } else {
                    createCredentialsResult = await this.createCredentialsWithFile(jenkinsHost, token, jenkinsCredentials, fileDetails.filePath, fileDetails.fileName, credentialsFolder);
                }

                if (!isSuccessCode(createCredentialsResult.status)) {
                    logger.warn("Failed to create jenkins credentials.");
                    if (attemptNumber < maxRetries) {
                        logger.warn(`Waiting to retry again in ${waitTime}ms...`);
                    }
                    return false;
                }

                return true;
            } catch (error) {
                logger.warn(`Failed to create jenkins credentials. Error: ${util.inspect(error)}`);
                if (attemptNumber < maxRetries) {
                    logger.warn(`Waiting to retry again in ${waitTime}ms...`);
                }
                return false;
            }
        });

        if (!result) {
            throw new QMError("Failed to create jenkins credentials. Instance was non responsive.");
        }
    }

    public async createBuildViewForApplication(jenkinsHost: string,
                                               token: string,
                                               gluonProjectName: string,
                                               gluonApplicationName: string) {
        logger.debug(`Trying to create jenkins view. jenkinsHost: ${jenkinsHost}; token: ${token}, gluonProjectName: ${gluonProjectName}, gluonApplicationName: ${gluonApplicationName}`);

        const owningJob = gluonProjectNameToJobName(gluonProjectName);
        const viewName = gluonApplicationNameToBuildViewName(gluonApplicationName);

        const viewExistsRequest = await this.jenkinsNetworkHandler.genericJenkinsGet(`https://${jenkinsHost}/job/${owningJob}/view/${viewName}`, token);

        if (isSuccessCode(viewExistsRequest.status)) {
            // View exists, don't proceed
            return viewExistsRequest;
        }

        const viewMode = "hudson.model.ListView";

        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `https://${jenkinsHost}/job/${owningJob}/createView`,
            {
                name: viewName,
                mode: viewMode,
                json: `${JSON.stringify({mode: viewMode, name: viewName})}`,
            },
            token,
            "application/x-www-form-urlencoded;charset=UTF-8",
        );

    }

    public async addBuildJobToApplicationView(jenkinsHost: string, token: string, gluonProjectName: string, gluonApplicationName: string, jobDisplayName: string) {
        const owningJob = gluonProjectNameToJobName(gluonProjectName);
        const viewName = gluonApplicationNameToBuildViewName(gluonApplicationName);

        return await this.jenkinsNetworkHandler.genericJenkinsPost(
            `https://${jenkinsHost}/job/${owningJob}/view/${viewName}/addJobToView?name=${gluonApplicationNameToBuildJobName(jobDisplayName)}`,
            {},
            token,
        );
    }

    public getProjectCredentialsDomain(projectName: string) {
        return `${projectName} Credentials`;
    }

    private getCredentialDomainUrl(jenkinsCredentialsFolder: JenkinsCredentialsFolder, jenkinsHost: string): string {
        if (jenkinsCredentialsFolder.domain.toUpperCase() === "GLOBAL") {
            return `https://${jenkinsHost}/credentials/store/system/domain/_`;
        } else {
            return `https://${jenkinsHost}/job/${jenkinsCredentialsFolder.jobName}/credentials/store/folder/domain/${jenkinsCredentialsFolder.domain}`;
        }
    }

    public set jenkinsNetworkHandlerInstance(jenkinsNetworkHandler: JenkinsNetworkHandler) {
        this.jenkinsNetworkHandler = jenkinsNetworkHandler;
    }
}

export interface JenkinsCredentialsFolder {
    domain: string;
    jobName?: string;
}
