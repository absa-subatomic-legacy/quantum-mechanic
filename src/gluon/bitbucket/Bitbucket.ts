import {logger} from "@atomist/automation-client";
import axios from "axios";
import {AxiosInstance} from "axios-https-proxy-fix";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import {QMConfig} from "../../config/QMConfig";

export function bitbucketAxios(): AxiosInstance {
    logger.info(`Finding certs: ${path.resolve(__dirname, QMConfig.subatomic.bitbucket.caPath)}`);
    const caFile = path.resolve(__dirname, QMConfig.subatomic.bitbucket.caPath);
    logger.info("Creating axios instance");
    return axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: true,
            ca: fs.readFileSync(caFile),
        }),
        auth: QMConfig.subatomic.bitbucket.auth,
        timeout: 20000,
    });
}

export function bitbucketUserFromUsername(username: string): Promise<any> {
    const options = requestPromiseOptions(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/admin/users?filter=${username}`);
    return rp(options)
        .then(user => {
            return user.body;
        });
}

export function bitbucketProjectFromKey(bitbucketProjectKey: string): Promise<any> {
    const options = requestPromiseOptions(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}`);
    return rp(options)
        .then(project => {
            return project.body;
        });
}

export function bitbucketRepositoriesForProjectKey(bitbucketProjectKey: string): Promise<any> {
    const options = requestPromiseOptions(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}/repos`);
    return rp(options)
        .then(repos => {
            return repos.body;
        });
}

export function bitbucketRepositoryForSlug(bitbucketProjectKey: string, slug: string): Promise<any> {
    const options = requestPromiseOptions(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}/repos/${slug}`);
    return rp(options)
        .then(repo => {
            return repo.body;
        });
}

function rp(options) {
    return require("request-promise")(options);
}

export function requestPromiseOptions(uri, method = "GET", includeCa = true): RequestPomiseOptionSet {
    const caFile = path.resolve(__dirname, QMConfig.subatomic.bitbucket.caPath);
    const options: RequestPomiseOptionSet = {
        method,
        uri,
        json: true,
    };
    if (includeCa) {
        options.agentOptions = {
            ca: fs.readFileSync(caFile),
        };
    }
    if (method === "POST" || method === "PUT") {
        options.body = {};

    }
    return options;
}

export interface RequestPomiseOptionSet {
    method: string;
    uri: string;
    agentOptions?: {
        ca: any,
    };

    [key: string]: any;
}
