import {isSuccessCode} from "../../http/Http";
import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {OpenshiftResource} from "./resources/OpenshiftResource";
import {ResourceFactory} from "./resources/ResourceFactory";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiCreate extends OpenShiftApiElement {

    public serviceAccount(serviceAccountName: string, namespace: string): Promise<OpenshiftApiResult> {
        return this.create(
            ResourceFactory.serviceAccountResource(serviceAccountName),
            namespace,
        );
    }

    public async create(resource: OpenshiftResource, namespace: string = "default", replace = false): Promise<OpenshiftApiResult> {
        if (replace) {
            return await this.replace(resource, namespace);
        }
        if (resource.kind === "List") {
            return await this.processList(resource, namespace, false);
        }
        const instance = this.getAxiosInstanceForResource(resource.kind);
        const url = ResourceUrl.getResourceKindUrl(resource.kind, namespace);
        return await instance.post(url, resource);
    }

    public async replace(resource: OpenshiftResource, namespace: string = "default"): Promise<OpenshiftApiResult> {
        if (resource.kind === "List") {
            return await this.processList(resource, namespace, true);
        }
        const instance = this.getAxiosInstanceForResource(resource.kind);
        const namedUrl = ResourceUrl.getNamedResourceUrl(resource.kind, resource.metadata.name, namespace);
        const exists = await instance.get(namedUrl);
        if (isSuccessCode(exists.status)) {
            return await instance.put(namedUrl, resource);
        }

        const url = ResourceUrl.getResourceKindUrl(resource.kind, namespace);
        return await instance.post(url, resource);
    }

    private async processList(resource: OpenshiftResource, namespace: string, replace = false): Promise<OpenshiftApiResult> {
        let status = 200;
        const result = {
            items: [],
        };
        for (const item of resource.items) {
            let createResult;
            if (replace) {
                createResult = await this.replace(item, namespace);
            } else {
                createResult = await this.create(item, namespace);
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
            }
        }
        return {
            data: result,
            status,
        };
    }

}
