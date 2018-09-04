import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {OpenshiftResource} from "./resources/OpenshiftResource";
import {ResourceFactory} from "./resources/ResourceFactory";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiCreate extends OpenShiftApiElement {

    public serviceAccount(serviceAccountName: string, namespace: string): Promise<OpenshiftApiResult> {
        return this.createFromResource(
            ResourceFactory.serviceAccountResource(serviceAccountName),
            namespace,
        );
    }

    public createFromResource(resource: OpenshiftResource, namespace: string = "default"): Promise<OpenshiftApiResult> {
        const instance = this.getAxiosInstanceForResource(resource.kind);
        const url = ResourceUrl.getResourceUrl(resource.kind, namespace);
        return instance.post(url, resource);
    }

}
