import {logger} from "@atomist/automation-client";
import {inspect} from "util";
import {QMConfig} from "../../../config/QMConfig";
import {AwaitAxios} from "../../util/shared/AwaitAxios";
import {QMError} from "../../util/shared/Error";
import {isSuccessCode} from "../../util/shared/Http";

export class ApplicationProdRequestService {

    constructor(public axiosInstance = new AwaitAxios()) {
    }

    public async createApplicationProdRequest(applicationProdDetails: any, rawResult: boolean = false): Promise<any> {
        logger.debug(`Trying to create application prod request.`);
        const prodRequestResult = await this.axiosInstance.post(`${QMConfig.subatomic.gluon.baseUrl}/applicationProdRequests`, applicationProdDetails);
        if (rawResult) {
            return prodRequestResult;
        }

        if (!isSuccessCode(prodRequestResult.status)) {
            logger.error(`Request to create application prod request failed: ${inspect(prodRequestResult)}`);
            throw new QMError("Unable to create the prod request. Please make sure that you are member of a team associated to the application");
        }

        return prodRequestResult.data;
    }

    public async getApplicationProdRequestById(applicationProdRequestId: string, rawResult: boolean = false): Promise<any> {
        logger.debug(`Trying to create application prod request.`);
        const prodRequestResult = await this.axiosInstance.get(`${QMConfig.subatomic.gluon.baseUrl}/applicationProdRequests/${applicationProdRequestId}`);
        if (rawResult) {
            return prodRequestResult;
        }

        if (!isSuccessCode(prodRequestResult.status)) {
            logger.error(`Request to create application prod request failed: ${inspect(prodRequestResult)}`);
            throw new QMError("Unable to create the prod request. Please make sure that you are member of a team associated to the application");
        }

        return prodRequestResult.data;
    }
}
