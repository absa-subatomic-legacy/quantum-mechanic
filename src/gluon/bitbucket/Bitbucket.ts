import axios from "axios";
import {AxiosInstance} from "axios-https-proxy-fix";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import {QMConfig} from "../../config/QMConfig";
import {addAxiosLogger} from "../shared/axiosLogger";

export function bitbucketAxios(): AxiosInstance {
    const caFile = path.resolve(__dirname, QMConfig.subatomic.bitbucket.caPath);
    const instance = axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: true,
            ca: fs.readFileSync(caFile),
        }),
        auth: QMConfig.subatomic.bitbucket.auth,
        timeout: 30000,
        proxy: false,
    });
    return addAxiosLogger(instance, "Bitbucket");
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
