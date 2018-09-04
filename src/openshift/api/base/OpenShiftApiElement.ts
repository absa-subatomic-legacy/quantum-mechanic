import axios, {AxiosInstance} from "axios";
import https = require("https");
import {ResourceUrl} from "../resources/ResourceUrl";
import {OpenshiftApiBaseRoute} from "./OpenshiftApiBaseRoute";
import {OpenShiftConfigContract} from "./OpenShiftConfigContract";

export abstract class OpenShiftApiElement {

    protected constructor(protected openShiftConfig: OpenShiftConfigContract) {
    }

    protected getAxiosInstanceOApi(): AxiosInstance {
        const instance = axios.create({
            baseURL: `${this.openShiftConfig.masterUrl}/oapi/v1/`,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
        });
        instance.defaults.headers.common.Authorization = "bearer " + this.openShiftConfig.auth.token;
        return instance;
    }

    protected getAxiosInstanceApi(): AxiosInstance {
        const instance = axios.create({
            baseURL: `${this.openShiftConfig.masterUrl}/api/v1/`,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
        });
        instance.defaults.headers.common.Authorization = "bearer " + this.openShiftConfig.auth.token;
        return instance;
    }

    protected getAxiosInstanceForResource(resourceKind: string) {
        if (ResourceUrl.getResourceApi(resourceKind) === OpenshiftApiBaseRoute.API) {
            return this.getAxiosInstanceApi();
        } else {
            return this.getAxiosInstanceOApi();
        }
    }

}
