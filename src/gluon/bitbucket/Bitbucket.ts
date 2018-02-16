import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as config from "config";
import axios from "axios";
import {AxiosInstance} from "axios-https-proxy-fix";

export function bitbucketAxios(): AxiosInstance {
    const caFile = path.resolve(__dirname, config.get("subatomic").bitbucket.ca);
    return axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: true,
            ca: fs.readFileSync(caFile),
        }),
        auth: config.get("subatomic").bitbucket.auth
    });
}

export function bitbucketUserFromUsername(username: string): Promise<any> {
    return bitbucketAxios().get(`${config.get("subatomic").bitbucket.baseUrl}/api/1.0/admin/users?filter=${username}`)
        .then(user => {
            return user.data;
        });
}

export function bitbucketProjectFromKey(bitbucketProjectKey: string): Promise<any> {
    return bitbucketAxios().get(`${config.get("subatomic").bitbucket.baseUrl}/api/1.0/projects/${bitbucketProjectKey}`)
        .then(project => {
            return project.data;
        });
}
