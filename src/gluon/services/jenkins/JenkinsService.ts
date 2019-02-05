import {logger} from "@atomist/automation-client";
import Axios, {AxiosInstance} from "axios";
import * as https from "https";
import * as _ from "lodash";
import * as qs from "query-string";
import * as util from "util";
import {AwaitAxios} from "../../../http/AwaitAxios";
import {addAxiosLogger} from "../../../http/AxiosLogger";
import {isSuccessCode} from "../../../http/Http";
import {QMError} from "../../util/shared/Error";
import {retryFunction} from "../../util/shared/RetryFunction";

export class JenkinsService {

    constructor(private axiosInstance = new AwaitAxios().setAxiosInstance(jenkinsAxios())) {
    }

    public async kickOffFirstBuild(jenkinsHost: string,
                                   token: string,
                                   gluonProjectName: string,
                                   gluonApplicationName: string) {
        logger.debug(`Trying to kick of first jenkins build. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}; gluonApplicationName: ${gluonApplicationName} `);
        return await this.genericJenkinsPost(
            `https://${jenkinsHost}/job/${_.kebabCase(gluonProjectName).toLowerCase()}/job/${_.kebabCase(gluonApplicationName).toLowerCase()}/build?delay=0sec`,
            "",
            token,
        );
    }

    public async kickOffBuild(jenkinsHost: string,
                              token: string,
                              gluonProjectName: string,
                              gluonApplicationName: string) {
        logger.debug(`Trying to kick of a jenkins build. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}; gluonApplicationName: ${gluonApplicationName} `);

        return await this.genericJenkinsPost(
            `https://${jenkinsHost}/job/${_.kebabCase(gluonProjectName).toLowerCase()}/job/${_.kebabCase(gluonApplicationName).toLowerCase()}/job/master/build?delay=0sec`,
            "",
            token,
        );
    }

    public async createCredentials(jenkinsHost: string,
                                   token: string,
                                   jenkinsCredentials: any,
                                   credentialsFolder: JenkinsCredentialsFolder = {domain: "GLOBAL"}) {
        logger.debug(`Trying to create jenkins credentials. jenkinsHost: ${jenkinsHost}; token: ${token}, domain: ${credentialsFolder.domain}`);
        const axios: AxiosInstance = jenkinsAxios();
        addXmlFormEncodedStringifyAxiosIntercepter(axios);

        const jenkinsCredentialDomainUrl = this.getCredentialDomainUrl(credentialsFolder, jenkinsHost);

        return await this.genericJenkinsPost(
            `${jenkinsCredentialDomainUrl}/createCredentials`,
            {
                json: `${JSON.stringify(jenkinsCredentials)}`,
            },
            token,
            "application/x-www-form-urlencoded;charset=UTF-8",
            axios,
        );

    }

    public async updateCredential(jenkinsHost: string,
                                  token: string,
                                  jenkinsXMLCredential: string,
                                  credentialName: string,
                                  credentialsFolder: JenkinsCredentialsFolder = {domain: "GLOBAL"}) {
        logger.debug(`Trying to update jenkins global credentials. jenkinsHost: ${jenkinsHost}; token: ${token}, domain: ${credentialsFolder.domain}`);

        const jenkinsCredentialDomainUrl = this.getCredentialDomainUrl(credentialsFolder, jenkinsHost);

        return await this.genericJenkinsPost(
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

        return await this.genericJenkinsPost(
            `${jenkinsCredentialDomainUrl}/createCredentials`,
            form,
            token,
            `multipart/form-data; boundary=${form._boundary}`,
        );
    }

    public async createJenkinsJob(jenkinsHost: string, token: string, gluonProjectName: string, gluonApplicationName, jobConfig: string): Promise<any> {
        logger.debug(`Trying to create jenkins job. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}; gluonApplicationName: ${gluonApplicationName}`);
        return await this.genericJenkinsPost(
            `https://${jenkinsHost}/job/${_.kebabCase(gluonProjectName).toLowerCase()}/createItem?name=${_.kebabCase(gluonApplicationName).toLowerCase()}`,
            jobConfig,
            token,
            "application/xml",
        );
    }

    public async createOpenshiftEnvironmentCredentials(jenkinsHost: string, token: string, gluonProjectName: string, credentialsConfig: string): Promise<any> {
        logger.debug(`Trying to create jenkins openshift credentials. jenkinsHost: ${jenkinsHost}; token: ${token}; gluonProjectName: ${gluonProjectName}`);
        return await this.genericJenkinsPost(
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

    public getProjectCredentialsDomain(projectName: string) {
        return `${projectName} Credentials`;
    }

    private async genericJenkinsPost(url: string, body: any, token: string, contentType?: string, axiosInstance?: AxiosInstance) {
        if (axiosInstance === undefined) {
            this.axiosInstance.setAxiosInstance(jenkinsAxios());
        } else {
            this.axiosInstance.setAxiosInstance(axiosInstance);
        }

        const headers: { [key: string]: string } = {
            Authorization: `Bearer ${token}`,
        };

        if (contentType !== undefined) {
            headers["Content-Type"] = contentType;
        }

        return this.axiosInstance.post(url,
            body,
            {
                headers,
            });
    }

    private getCredentialDomainUrl(jenkinsCredentialsFolder: JenkinsCredentialsFolder, jenkinsHost: string): string {
        if (jenkinsCredentialsFolder.domain.toUpperCase() === "GLOBAL") {
            return `https://${jenkinsHost}/credentials/store/system/domain/_`;
        } else {
            return `https://${jenkinsHost}/job/${jenkinsCredentialsFolder.jobName}/credentials/store/folder/domain/${jenkinsCredentialsFolder.domain}`;
        }
    }
}

export interface JenkinsCredentialsFolder {
    domain: string;
    jobName?: string;
}

function jenkinsAxios(): AxiosInstance {
    const instance = Axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
        }),
        timeout: 45000,
        proxy: false,
    });
    return addAxiosLogger(instance, "Jenkins");
}

function addXmlFormEncodedStringifyAxiosIntercepter(axios: AxiosInstance) {
    axios.interceptors.request.use(request => {
        if (request.data && (request.headers["Content-Type"].indexOf("application/x-www-form-urlencoded") !== -1)) {
            logger.debug(`Stringifying URL encoded data: ${qs.stringify(request.data)}`);
            request.data = qs.stringify(request.data);
        }
        return request;
    });
}
