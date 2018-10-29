import {logger} from "@atomist/automation-client";
import {AwaitAxios} from "../../http/AwaitAxios";
import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenshiftApiResult} from "./base/OpenshiftApiResult";
import {OpenshiftResource} from "./resources/OpenshiftResource";
import {ResourceFactory} from "./resources/ResourceFactory";
import {ResourceUrl} from "./resources/ResourceUrl";

export class OpenShiftApiPolicy extends OpenShiftApiElement {

    public addRoleToUsers(usernames: string[], role: string, namespace: string): Promise<OpenshiftApiResult> {
        if (usernames.length > 0 && usernames[0].startsWith("system:serviceaccount")) {
            const usernameSplit = usernames[0].split(":");
            usernames[0] = usernameSplit.pop();
            const sourceNamespace = usernameSplit.pop();
            return this.addRoleToServiceAccount(usernames[0], sourceNamespace, role, namespace);
        } else {
            return this.addRoleToUserAccount(usernames, role, namespace, false);
        }
    }

    public addRoleToServiceAccount(serviceAccount: string, sourceNamespace: string,
                                   role: string, destinationNamespace: string): Promise<OpenshiftApiResult> {
        const instance = this.getAxiosInstanceOApi();
        return this.findExistingRole(instance, role, destinationNamespace).then(existingRole => {
            if (existingRole === null) {
                const newRole = ResourceFactory.serviceAccountRoleBindingResource(sourceNamespace, role, serviceAccount, destinationNamespace);
                logger.debug("Role not found. Creating new role binding");

                return instance.post(ResourceUrl.getResourceKindUrl(ResourceFactory.baseResource("RoleBinding"), destinationNamespace), newRole);
            } else {
                existingRole.subjects.push({
                    kind: "ServiceAccount",
                    namespace: sourceNamespace,
                    name: serviceAccount,
                });
                existingRole.userNames.push(`system:serviceaccount:${sourceNamespace}:${serviceAccount}`);
                logger.debug("Found role. Added service account to role binding list");
                return instance.put(`${ResourceUrl.getResourceKindUrl(ResourceFactory.baseResource("RoleBinding"), destinationNamespace)}/${role}`, existingRole);
            }
        });
    }

    public async addRoleToUserAccount(usernames: string[], role: string, namespace: string, roleExists: boolean): Promise<OpenshiftApiResult> {

        const instance = this.getAxiosInstanceOApi();

        const roleBindingResourceObject = await this.getRoleBindingResource(role, namespace);
        const openshiftRole = roleBindingResourceObject.roleBinding;

        usernames.forEach( username => {
            openshiftRole.subjects.push({
                kind: "User",
                name: username,
            });
            openshiftRole.userNames.push(username);
        });

        if (roleBindingResourceObject.aNewRole) {
            logger.debug("Role not found. Creating new role binding...");
            return instance.post(ResourceUrl.getResourceKindUrl(ResourceFactory.baseResource("RoleBinding"), namespace), openshiftRole);
        } else {
            logger.debug("Found role. Adding user to role binding list...");
            return instance.put(`${ResourceUrl.getResourceKindUrl(ResourceFactory.baseResource("RoleBinding"), namespace)}/${role}`, openshiftRole);
        }
    }

    public async getRoleBindingResource(role: string, destinationNamespace) {

        let newRole = false;

        let openshiftRole = await this.findExistingRole(this.getAxiosInstanceOApi(), role, destinationNamespace);
        if (openshiftRole === null) {
            newRole = true;
            openshiftRole = ResourceFactory.baseRoleBindingResource(destinationNamespace, role);
            logger.debug("Role not found. Creating new role binding");
        } else {
            logger.debug("Role found OK");
        };
        return { roleBinding: openshiftRole, aNewRole: newRole };
    }

    public removeRoleFromUser(username: string, role: string, namespace: string): Promise<OpenshiftApiResult> {
        if (username.startsWith("system:serviceaccount")) {
            // Do not remove if service account - see Remove a team owner from a team #445 (https://github.com/absa-subatomic/quantum-mechanic/issues/445)
        } else {
            return this.removeRoleFromUserAccount(username, role, namespace);
        }
    }

    public removeRoleFromUserAccount(username: string, role: string, namespace: string): Promise<OpenshiftApiResult> {

        const instance = this.getAxiosInstanceOApi();

        return this.findExistingRole(instance, role, namespace).then(roleToEdit => {
            if (roleToEdit === null) {
                logger.info("Role not found. Nothing to do");
            } else {
                // Filter by all that are NOT the user to be removed
                roleToEdit.subjects = roleToEdit.subjects.filter(subject => subject.name !== username);
                roleToEdit.userName = roleToEdit.userNames.filter(userName => userName !== username);
                roleToEdit.userNames = roleToEdit.userNames.filter(userNames => userNames !== username);

                const url  = `${ResourceUrl.getResourceKindUrl(ResourceFactory.baseResource("RoleBinding"), namespace)}/${role}`;
                return instance.put(url, roleToEdit);
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
