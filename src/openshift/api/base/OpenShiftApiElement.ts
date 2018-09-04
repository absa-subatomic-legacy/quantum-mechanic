import Axios from "axios-https-proxy-fix";
import https = require("https");
import {AwaitAxios} from "../../../http/AwaitAxios";
import {ResourceUrl} from "../resources/ResourceUrl";
import {OpenshiftApiBaseRoute} from "./OpenshiftApiBaseRoute";
import {OpenShiftConfigContract} from "./OpenShiftConfigContract";

export abstract class OpenShiftApiElement {

    protected constructor(protected openShiftConfig: OpenShiftConfigContract) {
    }

    protected getAxiosInstanceOApi(): AwaitAxios {
        const instance = Axios.create({
            baseURL: `${this.openShiftConfig.masterUrl}/oapi/v1/`,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
        });
        instance.defaults.headers.common.Authorization = "bearer " + this.openShiftConfig.auth.token;
        return new AwaitAxios(instance);
    }

    protected getAxiosInstanceApi(): AwaitAxios {
        const instance = Axios.create({
            baseURL: `${this.openShiftConfig.masterUrl}/api/v1/`,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
        });
        instance.defaults.headers.common.Authorization = "bearer " + this.openShiftConfig.auth.token;
        return new AwaitAxios(instance);
    }

    protected getAxiosInstanceForResource(resourceKind: string) {
        if (ResourceUrl.getResourceApi(resourceKind) === OpenshiftApiBaseRoute.API) {
            return this.getAxiosInstanceApi();
        } else {
            return this.getAxiosInstanceOApi();
        }
    }

}
