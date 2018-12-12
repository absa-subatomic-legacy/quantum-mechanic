import {logger} from "@atomist/automation-client";
import {isSuccessCode} from "../../http/Http";
import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {OpenShiftConfigContract} from "./base/OpenShiftConfigContract";
import {ImmutabilityPreserver} from "./common/ImmutabilityPreserver";
import {OpenshiftResource} from "./resources/OpenshiftResource";
import {ResourceFactory} from "./resources/ResourceFactory";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiCreate extends OpenShiftApiElement {

    private immutabilityPreserver: ImmutabilityPreserver;

    constructor(openShiftConfig: OpenShiftConfigContract) {
        super(openShiftConfig);
        this.immutabilityPreserver = new ImmutabilityPreserver();
    }

    public async post( url: string, resource: OpenshiftResource, api: string = "v1") {
        const instance = this.getAxiosInstanceOApi(api);
        return await instance.post(url, resource);
    }

    public async create(resource: OpenshiftResource, namespace: string = "default", apply = false): Promise<OpenshiftApiResult> {
        logger.info(`Creating resource ${resource.kind} in ${namespace}`);
        if (apply) {
            return await this.apply(resource, namespace);
        }
        if (resource.kind === "List") {
            return await this.processList(resource, namespace, CreateType.create);
        }

        delete resource.metadata.uid;
        delete resource.metadata.resourceVersion;

        const instance = this.getAxiosInstanceForResource(resource);
        const url = ResourceUrl.getResourceKindUrl(resource, namespace);
        return await instance.post(url, resource);
    }

    public async apply(resource: OpenshiftResource, namespace: string = "default"): Promise<OpenshiftApiResult> {
        logger.info(`Applying resource ${resource.kind} in ${namespace}`);
        if (resource.kind === "List") {
            return await this.processList(resource, namespace, CreateType.apply);
        }
        const instance = this.getAxiosInstanceForResource(resource);
        const namedUrl = ResourceUrl.getNamedResourceUrl(resource, namespace);
        const exists = await instance.get(namedUrl);
        if (isSuccessCode(exists.status)) {
            return exists;
        }

        return this.create(resource, namespace);
    }

    public async replace(resource: OpenshiftResource, namespace: string = "default"): Promise<OpenshiftApiResult> {
        logger.info(`Replacing resource ${resource.kind} in ${namespace}`);
        if (resource.kind === "List") {
            return await this.processList(resource, namespace, CreateType.replace);
        }

        delete resource.metadata.uid;
        delete resource.metadata.resourceVersion;

        const instance = this.getAxiosInstanceForResource(resource);
        const namedUrl = ResourceUrl.getNamedResourceUrl(resource, namespace);
        const exists = await instance.get(namedUrl);
        if (isSuccessCode(exists.status)) {
            logger.info("Updating resource: " + namedUrl);

            this.immutabilityPreserver.preserveImmutability(resource, exists.data);

            return await instance.put(namedUrl, resource);
        }

        const url = ResourceUrl.getResourceKindUrl(resource, namespace);
        return await instance.post(url, resource);
    }

    private async processList(resource: OpenshiftResource, namespace: string, createType: CreateType): Promise<OpenshiftApiResult> {
        let status = 200;
        let statusText = "OK";
        const result = {
            items: [],
        };
        for (const item of resource.items) {
            let createResult;
            if (createType === CreateType.replace) {
                createResult = await this.replace(item, namespace);
            } else if (createType === CreateType.create) {
                createResult = await this.create(item, namespace);
            } else {
                createResult = await this.apply(item, namespace);
            }
            if (isSuccessCode(createResult.status)) {
                result.items.push(
                    {
                        data: createResult.data,
                        status: createResult.status,
                    },
                );
            } else {
                result.items.push(
                    {
                        data: createResult,
                        status: createResult.status,
                    },
                );
                status = 400;
                statusText = "Bad Request";
            }
        }
        return {
            data: result,
            status,
            statusText,
        };
    }

}

enum CreateType {
    create = "create",
    apply = "apply",
    replace = "replace",
}
