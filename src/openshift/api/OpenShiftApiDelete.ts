import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiDelete extends OpenShiftApiElement {

    public resource(resourceName: string, resourceKind: string,
                    namespace: string = "default"): Promise<OpenshiftApiResult> {
        const instance = this.getAxiosInstanceForResource(resourceKind);
        const url = ResourceUrl.getResourceUrl(resourceKind, namespace) + "/" + resourceName;
        return instance.delete(url);
    }
}
