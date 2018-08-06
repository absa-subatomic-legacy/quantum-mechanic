import axios from "axios";
import Axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios-https-proxy-fix";
import * as https from "https";

export class AwaitAxios {

    private static createAxiosInstance() {
        return Axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
            timeout: 45000,
            proxy: false,
        });
    }

    constructor(private axiosInstance: AxiosInstance = AwaitAxios.createAxiosInstance()) {
    }

    public async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        try {
            return await this.axiosInstance.post(url, data, config);
        } catch (error) {
            return error.response;
        }
    }

}