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
    const instance = axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: true,
            ca: fs.readFileSync(caFile),
        }),
        auth: QMConfig.subatomic.bitbucket.auth,
        timeout: 30000,
        proxy: false,
    });
    instance.interceptors.request.use(request => {
        if (request.proxy !== false) {
            console.log("Proxy: " + request.proxy);
        }
        console.log(`=> Bitbucket ${request.method} ${request.url} ${JSON.stringify(request.data)}`);
        return request;
    });

    instance.interceptors.response.use(response => {
        console.log(`<= Bitbucket ${response.status} ${response.request.url} ${JSON.stringify(response.data)}`);
        return response;
    }, error => {
        if (error && error.response) {
            console.log(`<= Bitbucket ${error.response.status} ${error.response.request.url} ${JSON.stringify(error.response.data)}`);
        } else {
            console.warn(`<= Bitbucket ${error}`);
        }
        return error;
    });
    return instance;
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
    return getBitbucketResources(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}/repos`);
}

export function bitbucketRepositoryForSlug(bitbucketProjectKey: string, slug: string): Promise<any> {
    return bitbucketAxios().get(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects/${bitbucketProjectKey}/repos/${slug}`)
        .then(repo => {
            return repo.data;
        });
}

export function bitbucketProjects() {
    return getBitbucketResources(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects`);
}

export function getBitbucketResources(resourceUri: string, axiosInstance: AxiosInstance = null, currentResources = []) {
    if (axiosInstance === null) {
        axiosInstance = bitbucketAxios();
    }
    return axiosInstance.get(`${resourceUri}?start=${currentResources.length}`).then(
        resources => {
            currentResources = currentResources.concat(resources.data.values);
            if (resources.data.isLastPage === true) {
                return Promise.resolve(currentResources);
            }

            return getBitbucketResources(resourceUri, axiosInstance, currentResources);
        },
    );
}
