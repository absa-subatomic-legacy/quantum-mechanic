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
    return bitbucketAxios().get(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/admin/users?filter=${username}`)
        .then(user => {
            return user.data;
        });
}

export function bitbucketProjectFromKey(bitbucketProjectKey: string): Promise<any> {
    return bitbucketAxios().get(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}`)
        .then(project => {
            return project.data;
        });
}

export function bitbucketRepositoriesForProjectKey(bitbucketProjectKey: string): Promise<any> {
    return bitbucketAxios().get(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}/repos`)
        .then(repos => {
            return repos.data;
        });
}

export function bitbucketRepositoryForSlug(bitbucketProjectKey: string, slug: string): Promise<any> {
    return bitbucketAxios().get(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}/repos/${slug}`)
        .then(repo => {
            return repo.data;
        });
}

export function requestPromiseOptions(uri, method = "GET", includeCa = true): RequestPomiseOptionSet {
    const caFile = path.resolve(__dirname, QMConfig.subatomic.bitbucket.caPath);
    const options: RequestPomiseOptionSet = {
        method,
        uri,
    };
    if (includeCa) {
        options.agentOptions = {
            ca: fs.readFileSync(caFile),
        };
    }
    if (method === "POST" || method === "PUT") {
        options.body = {};
        options.json = true;
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
