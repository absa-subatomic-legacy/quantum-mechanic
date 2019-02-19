import {logger, success} from "@atomist/automation-client";
import {isSuccessCode} from "../../../http/Http";
import {QMError} from "../../util/shared/Error";
import {JenkinsService} from "../jenkins/JenkinsService";

export class ConfigurePackageInJenkinsService {

    constructor(private jenkinsService = new JenkinsService()) {
    }

    public async createJenkinsJobAndAddToView(jenkinsHost: string,
                                              token: string,
                                              projectName: string,
                                              applicationName: string,
                                              jenkinsJobDisplayName: string,
                                              jenkinsJobXmlDefinition: string) {
        return await this.createMultipleJenkinsJobsAndAddToView(jenkinsHost, token, projectName, applicationName,
            [{
                jenkinsJobDisplayName,
                jenkinsJobXmlDefinition,
            }],
        );
    }

    public async createMultipleJenkinsJobsAndAddToView(jenkinsHost: string,
                                                       token: string,
                                                       projectName: string,
                                                       applicationName: string,
                                                       jenkinsJobs: JenkinsJobDefinition[],
    ) {
        const createViewResponse = await this.jenkinsService.createBuildViewForApplication(jenkinsHost, token, projectName, applicationName);

        if (!isSuccessCode(createViewResponse.status)) {
            throw new QMError(`Unable to create build view for application *${applicationName}*. This is likely caused connectivity issues to your Jenkins.`);
        }

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to add create Jenkins Job`);

        for (const jenkinsJob of jenkinsJobs) {

            const createJenkinsJobResponse = await this.jenkinsService.createJenkinsJobWithName(
                jenkinsHost,
                token,
                projectName,
                jenkinsJob.jenkinsJobDisplayName,
                jenkinsJob.jenkinsJobXmlDefinition);

            if (!isSuccessCode(createJenkinsJobResponse.status)) {
                if (createJenkinsJobResponse.status === 400) {
                    logger.warn(`Multibranch job for [${jenkinsJob.jenkinsJobDisplayName}] probably already created`);
                } else {
                    logger.error(`Unable to create jenkinsJob`);
                    throw new QMError("Failed to create jenkins job. Network request failed.");
                }
            }

            const addJobToViewResponse = await this.jenkinsService.addBuildJobToApplicationView(jenkinsHost, token, projectName, applicationName, jenkinsJob.jenkinsJobDisplayName);
            if (!isSuccessCode(addJobToViewResponse.status)) {
                throw new QMError(`Unable to add build to view for build job *${jenkinsJob.jenkinsJobDisplayName}*. This is likely caused connectivity issues to your Jenkins.`);
            }
        }

        return await success();
    }
}

export interface JenkinsJobDefinition {
    jenkinsJobDisplayName: string;
    jenkinsJobXmlDefinition: string;
}
