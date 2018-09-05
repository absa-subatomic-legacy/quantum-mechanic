import {isSuccessCode} from "../../http/Http";
import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiAdm extends OpenShiftApiElement {

    public async podNetworkJoinToProject(projectToJoin: string, projectToJoinTo: string): Promise<OpenshiftApiResult> {
        const instance = this.getAxiosInstanceNetworksApi();
        const checkForSupportUrl = ResourceUrl.getNetworkResourceUrl("clusternetwork", "default");
        const supported = await instance.get(checkForSupportUrl);
        if (!isSuccessCode(supported.status)) {
            return supported;
        }

        const projectNetNamespaceUrl = ResourceUrl.getNetworkResourceUrl("netnamespace", projectToJoin);
        const netNamespaceExists = await instance.get(projectNetNamespaceUrl);
        if (!isSuccessCode(netNamespaceExists.status)) {
            return netNamespaceExists;
        }

        const netNamespace = netNamespaceExists.data;

        if (netNamespace.metadata.annotations === undefined) {
            netNamespace.metadata.annotations = {} as { [key: string]: string };
        }

        netNamespace.metadata.annotations["pod.network.openshift.io/multitenant.change-network"] = `join:${projectToJoinTo}`;

        return await instance.put(projectNetNamespaceUrl, netNamespace);

    }

}
