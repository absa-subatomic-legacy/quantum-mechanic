import {logger} from "@atomist/automation-client";
import Axios, {AxiosInstance} from "axios";
import * as https from "https";
import {AwaitAxios} from "../../../http/AwaitAxios";
import {addAxiosLogger} from "../../../http/AxiosLogger";

import * as qs from "query-string";

export class JenkinsNetworkHandler {

    private awaitAxios: AwaitAxios;

    constructor() {
        this.awaitAxios = new AwaitAxios(jenkinsAxios());
    }

    public set axiosInstance(axiosInstance: AwaitAxios) {
        this.awaitAxios = axiosInstance;
    }

    public async genericJenkinsGet(url: string, token: string) {

        const headers: { [key: string]: string } = {
            Authorization: `Bearer ${token}`,
        };

        return await this.awaitAxios.get(url,
            {
                headers,
            });
    }

    public async genericJenkinsPost(url: string, body: any, token: string, contentType?: string) {

        const headers: { [key: string]: string } = {
            Authorization: `Bearer ${token}`,
        };

        if (contentType !== undefined) {
            headers["Content-Type"] = contentType;
        }

        return this.awaitAxios.post(url,
            body,
            {
                headers,
            });
    }

}

function jenkinsAxios(): AxiosInstance {
    const instance = Axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
        }),
        timeout: 45000,
        proxy: false,
    });
    addXmlFormEncodedStringifyAxiosIntercepter(instance);
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
