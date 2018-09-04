import {logger} from "@atomist/automation-client";
import {AwaitAxios} from "../../http/AwaitAxios";
import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {OpenshiftResource} from "./resources/OpenshiftResource";
import {ResourceFactory} from "./resources/ResourceFactory";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiPolicy extends OpenShiftApiElement {

    public addRoleToUser(username: string, role: string, namespace: string): Promise<OpenshiftApiResult> {
        if (username.startsWith("system:serviceaccount")) {
            username = username.split(":").pop();
            return this.addRoleToServiceAccount(username, role, namespace);
        } else {
            return this.addRoleToUserAccount(username, role, namespace);
        }
    }

    public addRoleToServiceAccount(serviceAccount: string,
                                   role: string, namespace: string): Promise<OpenshiftApiResult> {
        const instance = this.getAxiosInstanceOApi();
        return this.findExistingRole(instance, role, namespace).then(existingRole => {
            if (existingRole === null) {
                const newRole = ResourceFactory.serviceAccountRoleBindingResource(namespace, role, serviceAccount);
                logger.debug("Role not found. Creating new role binding");
                return instance.post(ResourceUrl.getResourceUrl("rolebinding", namespace), newRole);
            } else {
                existingRole.subjects.push({
                    kind: "ServiceAccount",
                    namespace,
                    name: serviceAccount,
                });
                existingRole.userNames.push(`system:serviceaccount:${namespace}:${serviceAccount}`);
                logger.debug("Found role. Added service account to role binding list");
                return instance.put(`${ResourceUrl.getResourceUrl("rolebinding", namespace)}/${role}`, existingRole);
            }
        });
    }

    private addRoleToUserAccount(username: string, role: string, namespace: string): Promise<OpenshiftApiResult> {
        const instance = this.getAxiosInstanceOApi();
        return this.findExistingRole(instance, role, namespace).then(existingRole => {
            if (existingRole === null) {
                const newRole = ResourceFactory.userRoleBindingResource(namespace, role, username);
                logger.debug("Role not found. Creating new role binding");
                return instance.post(ResourceUrl.getResourceUrl("rolebinding", namespace), newRole);
            } else {
                existingRole.subjects.push({
                    kind: "User",
                    name: username,
                });
                existingRole.userNames.push(username);
                logger.debug("Found role. Added user to role binding list");
                return instance.put(`${ResourceUrl.getResourceUrl("rolebinding", namespace)}/${role}`, existingRole);
            }
        });
    }

    private findExistingRole(axios: AwaitAxios, role: string, namespace: string): Promise<OpenshiftResource> {
        return axios.get(`namespaces/${namespace}/rolebindings`).then(response => {
            logger.debug(JSON.stringify(response.status));
            logger.debug(JSON.stringify(response.data));
            let openshiftResource: OpenshiftResource = null;
            for (const item of response.data.items) {
                if (item.metadata.name === role.toLowerCase() && item.metadata.namespace === namespace.toLowerCase()) {
                    openshiftResource = ResourceFactory.convertToOpenshiftResource(item, "RoleBinding");
                    break;
                }
            }
            return openshiftResource;
        });

    }
}
