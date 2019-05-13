import Axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios";
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

    constructor(public axiosInstance: AxiosInstance = AwaitAxios.createAxiosInstance()) {
    }

    public setAxiosInstance(axiosInstance: AxiosInstance): AwaitAxios {
        this.axiosInstance = axiosInstance;
        return this;
    }

    public async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        try {
            return await this.axiosInstance.post(url, data, config);
        } catch (error) {
            return error.response;
        }
    }

    public async put(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        try {
            return await this.axiosInstance.put(url, data, config);
        } catch (error) {
            return error.response;
        }
    }

    public async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        try {
            return await this.axiosInstance.get(url, config);
        } catch (error) {
            return error.response;
        }
    }

    public async delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        try {
            return await this.axiosInstance.delete(url, config);
        } catch (error) {
            return error.response;
        }
    }

    public async patch(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        try {
            return await this.axiosInstance.patch(url, data, config);
        } catch (error) {
            return error.response;
        }
    }

}
