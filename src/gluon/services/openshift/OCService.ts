import {OpenshiftApiResult} from "@absa-subatomic/openshift-api/build/src/base/OpenshiftApiResult";
import {OpenShiftApi} from "@absa-subatomic/openshift-api/build/src/OpenShiftApi";
import {
    OpenshiftListResource,
    OpenshiftResource,
} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {logger} from "@atomist/automation-client";
import * as fs from "fs";
import _ = require("lodash");
import {inspect} from "util";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {userFromDomainUser} from "../../util/member/Members";
import {OpaqueSecret} from "../../util/openshift/OpaqueSecret";
import {BaseProjectTemplateLoader} from "../../util/resources/BaseProjectTemplateLoader";
import {QuotaLoader} from "../../util/resources/QuotaLoader";
import {QMError, QMErrorType} from "../../util/shared/Error";
import {retryFunction} from "../../util/shared/RetryFunction";
import {QMTeam} from "../../util/transform/types/gluon/Team";
import {OCImageService} from "./OCImageService";

export class OCService {

    get openShiftApi(): OpenShiftApi {
        if (this.openShiftApiInstance === undefined) {
            logger.error(`Failed to access the openShiftApiInstance. Make sure the you have performed an OCService.setOpenShiftDetails command`);
            throw new QMError("OpenShift login failure!");
        }
        return this.openShiftApiInstance;
    }

    set openShiftApi(value: OpenShiftApi) {
        this.openShiftApiInstance = value;
    }

    private openShiftApiInstance: OpenShiftApi;

    private quotaLoader: QuotaLoader = new QuotaLoader();
    private baseProjectTemplateLoader: BaseProjectTemplateLoader = new BaseProjectTemplateLoader();

    constructor(private ocImageService = new OCImageService()) {
    }

    public async setOpenShiftDetails(openshiftDetails: OpenShiftConfig) {
        this.openShiftApi = new OpenShiftApi(openshiftDetails);
        this.ocImageService.openShiftApi = this.openShiftApi;
    }

    public async newDevOpsProject(openshiftProjectId: string, teamName: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to create new Dev Ops environment. openshiftProjectId: ${openshiftProjectId}; teamName: ${teamName} `);

        const createResult = await this.openShiftApi.newProject(openshiftProjectId,
            `${teamName} DevOps`,
            `DevOps environment for ${teamName} [managed by Subatomic]`);
        if (rawResult) {
            return createResult;
        } else if (!isSuccessCode(createResult.status)) {
            if (createResult.status === 409) {
                throw new QMError("DevOps project already exists.", undefined, QMErrorType.conflict);
            } else {
                logger.error(`Failed to create DevOps project: ${inspect(createResult)}`);
                throw new QMError("Failed to create the OpenShift DevOps project as requested");
            }
        }
        return createResult.data;
    }

    public async newSubatomicProject(openshiftProjectId: string, projectDisplayName: string, projectName: string, environmentPrefix: string, rawResult = false): Promise<any> {
        logger.debug(`Trying to create new Subatomic Project. openshiftProjectId: ${openshiftProjectId}; projectDisplayName: ${projectDisplayName}; projectName: ${projectName}; environmentPrefix: ${environmentPrefix} `);
        const createResult = await this.openShiftApi.newProject(openshiftProjectId,
            projectDisplayName,
            `${environmentPrefix} environment for ${projectName} [managed by Subatomic]`);
        if (rawResult) {
            return createResult;
        } else if (!isSuccessCode(createResult.status)) {
            if (createResult.status === 409) {
                throw new QMError("Requested project already exists.", undefined, QMErrorType.conflict);
            } else {
                logger.error(`Failed to create OpenShift project: ${inspect(createResult)}`);
                throw new QMError("Failed to create the OpenShift project as requested");
            }
        }
        return createResult.data;
    }

    public async createDevOpsDefaultResourceQuota(openshiftProjectId: string, replace = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create DevOps default resource quota. openshiftProjectId: ${openshiftProjectId}`);
        const defaultResourceQuota: OpenshiftResource = this.quotaLoader.getDevOpsDefaultResourceQuota();

        let quotaExists = true;
        let openshiftApiResult;
        try {
            openshiftApiResult = await this.openShiftApi.get.get(defaultResourceQuota.kind, defaultResourceQuota.metadata.name, openshiftProjectId);
        } catch (e) {
            quotaExists = false;
        }

        if (!quotaExists) {
            const createResult = await this.openShiftApi.create.create(
                defaultResourceQuota,
                openshiftProjectId,
                replace,
            );

            if (rawResult) {
                return createResult;
            } else if (!isSuccessCode(createResult.status)) {
                logger.error(`Failed to create default quota in DevOps: ${inspect(createResult)}`);
                throw new QMError("Failed to create the OpenShift default Quota in DevOps as requested");
            }
            return createResult.data;
        } else {
            logger.info(`Default Quota already exists in namespace: ${openshiftProjectId}`);
            return openshiftApiResult.data;
        }
    }

    public async createDevOpsDefaultLimits(openshiftProjectId: string, apply = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create DevOps default limits. openshiftProjectId: ${openshiftProjectId}`);

        const defaultLimitRange: OpenshiftResource = this.quotaLoader.getProjectDefaultLimitRange();

        let limitExists = true;
        let openshiftApiResult;
        try {
            openshiftApiResult = await this.openShiftApi.get.get(defaultLimitRange.kind, defaultLimitRange.metadata.name, openshiftProjectId);
        } catch (e) {
            limitExists = false;
        }

        if (!limitExists) {
            const createResult = await this.openShiftApi.create.create(
                this.quotaLoader.getDevOpsDefaultLimitRange(),
                openshiftProjectId,
                apply,
            );

            if (rawResult) {
                return createResult;
            } else if (!isSuccessCode(createResult.status)) {
                logger.error(`Failed to create default limits in DevOps: ${inspect(createResult)}`);
                throw new QMError("Failed to create the OpenShift default-limits in DevOps as requested");
            }

            return createResult.data;
        } else {
            logger.info(`Default Limit already exists in namespace: ${openshiftProjectId}`);
            return openshiftApiResult.data;
        }
    }

    public async createProjectDefaultResourceQuota(openshiftProjectId: string, apply = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create project default resource quota. openshiftProjectId: ${openshiftProjectId}`);

        const defaultResourceQuota: OpenshiftResource = this.quotaLoader.getProjectDefaultResourceQuota();

        let quotaExists = true;
        let openshiftApiResult;
        try {
            openshiftApiResult = await this.openShiftApi.get.get(defaultResourceQuota.kind, defaultResourceQuota.metadata.name, openshiftProjectId);
        } catch (e) {
            quotaExists = false;
        }

        if (!quotaExists) {
            const createResult = await this.openShiftApi.create.create(
                defaultResourceQuota,
                openshiftProjectId,
                apply,
            );

            if (rawResult) {
                return createResult;
            } else if (!isSuccessCode(createResult.status)) {
                logger.error(`Failed to create default quota in project: ${inspect(createResult)}`);
                throw new QMError("Failed to create the OpenShift default Quota in project as requested");
            }
            return createResult.data;
        } else {
            logger.info(`Default Quota already exists in namespace: ${openshiftProjectId}`);
            return openshiftApiResult.data;
        }
    }

    public async createProjectDefaultLimits(openshiftProjectId: string, apply = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create project default limits. openshiftProjectId: ${openshiftProjectId}`);

        const defaultLimitRange: OpenshiftResource = this.quotaLoader.getProjectDefaultLimitRange();

        let limitExists = true;
        let openshiftApiResult;
        try {
            openshiftApiResult = await this.openShiftApi.get.get(defaultLimitRange.kind, defaultLimitRange.metadata.name, openshiftProjectId);
        } catch (e) {
            limitExists = false;
        }

        if (!limitExists) {
            const createResult = await this.openShiftApi.create.create(
                this.quotaLoader.getProjectDefaultLimitRange(),
                openshiftProjectId,
                apply,
            );

            if (rawResult) {
                return createResult;
            } else if (!isSuccessCode(createResult.status)) {
                logger.error(`Failed to create default limits in project: ${inspect(createResult)}`);
                throw new QMError("Failed to create the OpenShift default-limits in project as requested");
            }
            return createResult.data;
        } else {
            logger.info(`Default Limit already exists in namespace: ${openshiftProjectId}`);
            return openshiftApiResult.data;
        }
    }

    public async getSubatomicTemplate(templateName: string, namespace: string = "subatomic"): Promise<OpenshiftResource> {
        logger.debug(`Trying to get subatomic template. templateName: ${templateName}`);
        const response = await this.openShiftApi.get.get("template", templateName, namespace);
        if (isSuccessCode(response.status)) {
            logger.debug(`Found ${templateName} for namespace: ${namespace} | template JSON: ${JSON.stringify(response.data)}`);
            return response.data;
        } else {
            logger.error(`Failed to find Subatomic Templates in Subatomic namespace: ${inspect(response)}`);
            throw new QMError("Failed to find Subatomic Templates in the Subatomic namespace");
        }
    }

    public async getSubatomicAppTemplates(namespace = "subatomic"): Promise<OpenshiftResource[]> {
        logger.debug(`Trying to get subatomic templates. namespace: ${namespace}`);
        const queryResult = await this.openShiftApi.get.getAllFromNamespace("Template", namespace, "v1");

        if (isSuccessCode(queryResult.status)) {
            const templates = [];
            for (const template of queryResult.data.items) {
                if (template.metadata.labels !== undefined) {
                    if (template.metadata.labels.usage === "subatomic-app") {
                        // These aren't set for some reason
                        template.kind = "Template";
                        template.apiVersion = "v1";
                        templates.push(template);
                    }
                }
            }
            return templates;
        } else {
            logger.error(`Failed to find Subatomic App Templates in Subatomic namespace: ${inspect(queryResult)}`);
            throw new QMError("Failed to find Subatomic App Templates in the Subatomic namespace");
        }
    }

    public async getTemplate(templateName: string, namespace: string): Promise<OpenshiftResource> {
        logger.debug(`Trying to get template ${templateName} for namespace ${namespace}`);
        const response = await this.openShiftApi.get.get("template", templateName, namespace);
        if (isSuccessCode(response.status)) {
            logger.debug(`Found template ${templateName} for namespace ${namespace}`);
            return response.data;
        } else {
            logger.error(`Failed to find template ${templateName} for namespace ${namespace}, status code: ${response.status} status text: ${response.statusText}`);
            throw new QMError(`Failed to find template ${templateName} for namespace ${namespace}`);
        }
    }

    public async getSubatomicImageStreamTags(namespace: string) {
        return this.ocImageService.getAllSubatomicImageStreams(namespace);
    }

    public async getImageStream(imageStreamName: string, namespace: string): Promise<OpenshiftResource> {
        return await this.ocImageService.getImageStream(imageStreamName, namespace);
    }

    public async applyResourceFromDataInNamespace(resourceDefinition: OpenshiftResource, projectNamespace: string, applyNotReplace: boolean = false): Promise<OpenshiftApiResult> {
        // TODO: Change this applyNotReplace to an enum for more clarity.
        logger.debug(`Trying to create resource from data in namespace. projectNamespace: ${projectNamespace}`);

        let response: OpenshiftApiResult;
        if (applyNotReplace) {
            response = await this.openShiftApi.create.apply(resourceDefinition, projectNamespace);
        } else {
            response = await this.openShiftApi.create.replace(resourceDefinition, projectNamespace);
        }

        if (!isSuccessCode(response.status)) {
            logger.error(`Failed to create requested resource.\nResource: ${JSON.stringify(resourceDefinition)}`);
            if (!_.isEmpty(response.data.items)) {
                for (const item of response.data.items) {
                    if (!isSuccessCode(item.status)) {
                        logger.error(`Resource Failed: ${inspect(item.data)}`);
                    }
                }
            } else {
                logger.error(`Resource Failed: ${inspect(response)}`);
            }
            throw new QMError("Failed to create requested resource");
        }

        return response;
    }

    public async processJenkinsTemplateForDevOpsProject(devopsNamespace: string, jenkinsResourceNamespace: string, dockerRegistryUrl: string): Promise<any> {
        logger.debug(`Trying to process jenkins template for devops project template. devopsNamespace: ${devopsNamespace}`);

        // TODO: this should be a property on Team. I.e. teamEmail
        // TODO: the registry Cluster IP we will have to get by introspecting the registry Service
        const params = [
            {key: "NAMESPACE", value: jenkinsResourceNamespace},
            {key: "BITBUCKET_NAME", value: "Subatomic Bitbucket"},
            {key: "BITBUCKET_URL", value: QMConfig.subatomic.bitbucket.baseUrl},
            {
                key: "BITBUCKET_CREDENTIALS_ID",
                value: `${devopsNamespace}-bitbucket`,
            },
            {key: "JENKINS_ADMIN_EMAIL", value: "subatomic@local"},
            {
                key: "NAMESPACE_URL",
                value: `${dockerRegistryUrl}/${jenkinsResourceNamespace}`,
            },
        ];

        return await this.findAndProcessOpenshiftTemplate("jenkins-persistent-subatomic", jenkinsResourceNamespace, params);
    }

    public async findAndProcessOpenshiftTemplate(templateName: string, namespace: string, params: Array<{ key: string, value: string }>, ignoreUnknownParameters: boolean = false) {
        logger.debug(`Trying to find And Process Openshift Template template. templateName: ${templateName}`);

        // Get the required template
        const template: OpenshiftResource = await this.getTemplate(templateName, namespace);

        // Find the templateParam for each passed in parameter and then set the value
        logger.debug(`templateParams before mapping: ${JSON.stringify(template)}`);
        params.forEach(pMap => {
            template.parameters.forEach(tempParam => {
                if (tempParam.name === pMap.key) {
                    tempParam.value = pMap.value;
                }
            });
        });

        logger.debug(`templateParams after mapping: ${JSON.stringify(template)}`);
        return await this.processOpenShiftTemplate(namespace, template, templateName);
    }

    public async processOpenShiftTemplate(namespace: string, template: OpenshiftResource, templateName: string) {
        logger.debug(`Trying to Process Openshift Template template. templateName: ${templateName}`);
        // Post the populated template
        const response = await this.openShiftApi.create.post(`namespaces/${namespace}/processedtemplates`, template);
        if (isSuccessCode(response.status)) {
            logger.debug(`Processed template ${templateName} for namespace ${namespace} OK `);

            const returnedTemplate: OpenshiftResource = response.data;

            // Build the list object from the response object (objects[] maps to items[])
            const openShiftResourceList: OpenshiftListResource = {
                kind: "List",
                apiVersion: "v1",
                metadata: {},
                items: returnedTemplate.objects,
            };
            logger.info(`Processed template ${templateName} for namespace ${namespace} OK`);
            return openShiftResourceList;
        } else {
            logger.error(`Failed to process template ${templateName} for namespace ${namespace}, status code: ${response.status} status text: ${response.statusText}`);
            throw new QMError(`Failed to create resource from template ${templateName} for namespace ${namespace}`);
        }
    }

    public async getDeploymentConfigInNamespace(dcName: string, namespace: string): Promise<OpenshiftResource> {
        logger.debug(`Trying to get dc in namespace. dcName: ${dcName}, namespace: ${namespace}`);
        const response: OpenshiftApiResult = await this.openShiftApi.get.get("deploymentconfig", dcName, namespace);
        if (isSuccessCode(response.status)) {
            logger.debug(`Found dc/${dcName} for namespace: ${namespace} | template JSON: ${JSON.stringify(response.data)}`);
            return response.data;
        } else {
            logger.error(`Failed to find dc${dcName} in Subatomic namespace: ${inspect(response)}`);
            throw new QMError("Failed to find dcName in the Subatomic namespace");
        }
    }

    public async rolloutDeploymentConfigInNamespace(dcName: string, namespace: string): Promise<OpenshiftResource> {
        logger.debug(`Trying to rollout dc in namespace. dcName: ${dcName}, namespace: ${namespace}`);
        const response: OpenshiftApiResult = await this.openShiftApi.get.get("deploymentconfig", `${dcName}/status`, namespace);
        if (isSuccessCode(response.status)) {
            return response.data;
        } else {
            logger.error(`Failed to find dc${dcName} in Subatomic namespace: ${inspect(response)}`);
            throw new QMError("Failed to find dcName in the Subatomic namespace");
        }
    }

    public async getServiceAccountToken(serviceAccountName: string, namespace: string): Promise<string> {
        logger.debug(`Trying to get service account token in namespace. serviceAccountName: ${serviceAccountName}, namespace: ${namespace}`);

        let tokenSecretName: string = "";
        await retryFunction(4, 5000, async (attemptNumber: number) => {
            logger.warn(`Trying to get service account token. Attempt number ${attemptNumber}.`);

            const serviceAccountResult = await this.openShiftApi.get.get("ServiceAccount", serviceAccountName, namespace);

            if (!isSuccessCode(serviceAccountResult.status)) {
                logger.error(`Failed to find service account ${serviceAccountName} in namespace ${namespace}. Error: ${inspect(serviceAccountResult)}`);
                throw new QMError(`Failed to find service account ${serviceAccountName} in namespace ${namespace}`);
            }

            if (!_.isEmpty(serviceAccountResult.data.secrets)) {
                logger.info(JSON.stringify(serviceAccountResult.data));
                for (const secret of serviceAccountResult.data.secrets) {
                    if (secret.name.startsWith(`${serviceAccountName}-token`)) {
                        tokenSecretName = secret.name;
                        return true;
                    }
                }
            }

            if (attemptNumber < 4) {
                logger.warn(`Waiting to retry again in ${5000}ms...`);
            }

            return false;
        });

        if (_.isEmpty(tokenSecretName)) {
            throw new QMError(`Failed to find token for ServiceAccount ${serviceAccountName}`);
        }

        const secretDetailsResult = await this.openShiftApi.get.get("Secret", tokenSecretName, namespace);

        if (!isSuccessCode(secretDetailsResult.status)) {
            logger.error(`Failed to find secret ${tokenSecretName}. Error: ${inspect(secretDetailsResult)}`);
            throw new QMError(`Failed to find secret containing the jenkins token. Please make sure it exists.`);
        }

        return Buffer.from(secretDetailsResult.data.data.token, "base64").toString("ascii");
    }

    public async annotateJenkinsRoute(namespace: string): Promise<OpenshiftResource> {
        logger.debug(`Trying to annotate jenkins route in namespace. namespace: ${namespace}...`);
        // Get the jenkins route object for namespace x
        const response = await this.openShiftApi.get.get("route", "jenkins", namespace);
        if (isSuccessCode(response.status)) {
            logger.debug(`Found jenkins host: ${response.data.spec.host} for namespace: ${namespace}`);

            const jenkinsRoute: OpenshiftResource = response.data;
            const key = "haproxy.router.openshiftNonProd.io/timeout";
            const value = "120s";
            const annotations = Object.entries(jenkinsRoute.metadata.annotations).map(p => ({
                key: p[0],
                value: p[1],
            }));

            // If KVP combination doesn't exist...
            if (!annotations.some(a => a.key === key && a.value === value)) {
                // ... add it to the annotations object and patch resource
                jenkinsRoute.metadata.annotations[key] = value;
                const patchResponse: OpenshiftApiResult = await this.openShiftApi.patch.patch(jenkinsRoute, namespace, false);
                if (isSuccessCode(patchResponse.status)) {
                    logger.info(`Patched jenkins resource for ${namespace} OK `);
                    return await patchResponse.data;
                } else {
                    logger.error(`Failed to patch jenkins resource for ${namespace} | response JSON: ${JSON.stringify(patchResponse)}`);
                    throw new QMError(`Failed to patch jenkins resource for ${namespace}`);
                }
            } else {
                logger.info("Annotation already exists, nothing to do");
                return jenkinsRoute;
            }
        } else {
            logger.error(`Failed to find jenkins host for namespace ${namespace} | response JSON: ${JSON.stringify(response)}`);
            throw new QMError(`Failed to find jenkins host for namespace ${namespace}`);
        }
    }

    public async getJenkinsHost(namespace: string): Promise<string> {
        logger.debug(`Trying to get jenkins host ...`);
        const response = await this.openShiftApi.get.get("route", "jenkins", namespace);
        if (isSuccessCode(response.status)) {
            logger.debug(`Found jenkins host: ${response.data.spec.host} for namespace: ${namespace}`);
            return response.data.spec.host;
        } else {
            logger.error(`Failed to find jenkins host for namespace ${namespace} | response JSON: ${JSON.stringify(response)}`);
            throw new QMError(`Failed to find jenkins host for namespace ${namespace}`);
        }
    }

    public async getSecretFromNamespace(secretName: string, namespace: string): Promise<OpenshiftApiResult> {
        logger.debug(`Trying to get secret in namespace. secretName: ${secretName}, namespace: ${namespace}`);
        const secretResult = await this.openShiftApi.get.get("Secret", secretName, namespace);
        if (!isSuccessCode(secretResult.status)) {
            throw new QMError(`Failed to secret ${secretName} from namespace ${namespace}`);
        }
        return secretResult;
    }

    public async createBitbucketSSHAuthSecret(secretName: string, namespace: string, apply = true): Promise<OpenshiftApiResult> {
        logger.debug(`Trying to create bitbucket ssh auth secret in namespace. secretName: ${secretName}, namespace: ${namespace}`);

        const secret = new OpaqueSecret(secretName);
        secret.addFile("ssh-privatekey", QMConfig.subatomic.bitbucket.cicdPrivateKeyPath);
        secret.addFile("ca.crt", QMConfig.subatomic.bitbucket.caPath);

        const createSecretResult = await this.openShiftApi.create.create(secret, namespace, apply);
        if (!isSuccessCode(createSecretResult.status)) {
            logger.error(`Failed to create the secret ${secretName} in namespace ${namespace}: ${inspect(createSecretResult)}`);
            throw new QMError(`Failed to create secret ${secretName}.`);
        }
        return createSecretResult;
    }

    public async createConfigServerSecret(namespace: string): Promise<OpenshiftResource> {
        logger.debug(`Trying to create config server secret for namespace: ${namespace}...`);

        logger.debug("Extracting raw ssh key from cicd key");
        // Ignore the ssh-rsa encoding string, and any user name details at the end.
        const nme = "subatomic-config-server";
        const rawSSHKey = Buffer.from(QMConfig.subatomic.bitbucket.cicdKey.split(" ")[1]).toString("base64");
        const cicdPrivateKey = fs.readFileSync(
            QMConfig.subatomic.bitbucket.cicdPrivateKeyPath).toString("base64");
        const secretResource: OpenshiftResource = {
            kind: "Secret",
            apiVersion: "v1",
            metadata: {
                name: nme,
                creationTimestamp: null,
            },
            data: {
                "spring.cloud.config.server.git.hostKey": rawSSHKey,
                "spring.cloud.config.server.git.privateKey": cicdPrivateKey,
            },
        };

        const response = await this.openShiftApi.create.create(secretResource, namespace, true);
        if (isSuccessCode(response.status)) {
            logger.debug(`Created secret for ${nme} for namespace: ${namespace} OK`);
            return response.data;
        } else {
            logger.error(`Failed to createsecret for ${nme} for namespace: ${namespace}, ${inspect(response)}`);
            throw new QMError(`Failed to createsecret for ${nme} for namespace: ${namespace}`);
        }
    }

    public async addTeamMembershipPermissionsToProject(projectId: string, team: QMTeam, usernameCase: string) {
        const teamOwners = team.owners.map(owner => userFromDomainUser(owner.domainUsername, usernameCase));
        if (teamOwners.length > 0) {
            logger.debug(`Trying to add team membership permission to project for role admin.`);
            await this.openShiftApi.policy.addRoleToUsers(teamOwners, "admin", projectId);
        }

        const teamMembers = team.members.map(member => userFromDomainUser(member.domainUsername, usernameCase));
        if (teamMembers.length > 0) {
            logger.debug(`Trying to add team membership permission to project for role edit.`);
            await this.openShiftApi.policy.addRoleToUsers(teamMembers, "edit", projectId);
        }
    }

    public async removeTeamMembershipPermissionsFromProject(projectId: string, domainUserName: string, usernameCase: string): Promise<OpenshiftApiResult> {
        const memberUsername = userFromDomainUser(domainUserName, usernameCase);
        logger.info(`Removing role from project [${projectId}] and member [${domainUserName}]: ${memberUsername}`);
        return await this.openShiftApi.policy.removeRoleFromUser(memberUsername, "edit", projectId);
    }

    public async createPodNetwork(projectToJoin: string, projectToJoinTo: string): Promise<OpenshiftApiResult> {
        logger.debug(`Trying to create pod network. projectToJoin: ${projectToJoin}; projectToJoinTo: ${projectToJoinTo}`);

        return this.openShiftApi.adm.podNetworkJoinToProject(projectToJoin, projectToJoinTo);
    }

    public async addRoleToUserInNamespace(user: string, role: string, namespace: string): Promise<OpenshiftApiResult> {
        logger.debug(`Trying to add role to user in namespace: user: ${user}; role: ${role}; namespace: ${namespace}`);
        const addRoleResult = await this.openShiftApi.policy.addRoleToUsers([user], role, namespace);
        if (!isSuccessCode(addRoleResult.status)) {
            logger.error(`Failed to grant the role ${role} to account ${user}. Error: ${inspect(addRoleResult)}`);
            throw new QMError(`Failed to grant the role ${role} to account ${user}.`);
        }
        return addRoleResult;
    }

    public async createPVC(pvcName: string, namespace: string, size: string = "10Gi", accessModes: string[] = ["ReadWriteMany"]): Promise<OpenshiftResource> {
        logger.debug(`Trying to create pvc in namespace. pvcName: ${pvcName}; namespace: ${namespace}...`);

        const persistentVolumeClasimObject = {
            kind: "PersistentVolumeClaim",
            apiVersion: "v1",
            metadata: {
                name: pvcName,
            },
            spec: {
                accessModes,
                resources: {
                    requests: {
                        storage: size,
                    },
                },
            },
        };

        const response = await this.openShiftApi.create.create(persistentVolumeClasimObject, namespace, true);
        if (isSuccessCode(response.status)) {
            logger.debug(`Created PVC ${pvcName} for namespace: ${namespace} OK`);
            return response.data;
        } else {
            logger.error(`Failed to create PVC ${pvcName} for ${namespace}, ${inspect(response)}`);
            throw new QMError(`Failed to create PVC ${pvcName} for ${namespace}`);
        }
    }

    public async initilizeProjectWithDefaultProjectTemplate(projectNamespaceId: string, projectName: string, apply = true) {
        logger.debug(`Trying to initialize project with default project template ${projectNamespaceId}...`);
        const template = this.baseProjectTemplateLoader.getTemplate();
        if (!_.isEmpty(template.objects)) {
            logger.info(`Base template is NOT empty for projectNamespaceId: ${projectNamespaceId}`);
            const processedTemplateResult: OpenshiftResource = await this.processOpenShiftTemplate(projectNamespaceId, template, "New-Project-Template");
            const result = await this.applyResourceFromDataInNamespace(processedTemplateResult, projectNamespaceId, apply);
            if (!isSuccessCode(result.status)) {
                logger.error(`Template failed to create properly: ${inspect(result)}`);
                throw new QMError("Failed to create all items in base project template.");
            }
        } else {
            logger.info(`Base template is empty. Not applying to project ${projectNamespaceId}`);
        }
    }

    public async findProject(projectId: string) {
        logger.debug(`Trying to find project ${projectId}...`);
        let project: OpenshiftResource = null;
        const response = await this.openShiftApi.get.get("project", projectId, null);
        if (isSuccessCode(response.status)) {
            project = response.data;
            logger.debug(`Project ${projectId} found OK`);
        }
        return project;
    }

    public async exportAllResources(
        projectIdNameSpace: string,
        resourceKindsRequired: string[] = ["Service", "DeploymentConfig", "ImageStream", "Route", "PersistentVolumeClaim"],
    ): Promise<OpenshiftListResource> {
        logger.debug("Trying to export all required resources...");

        const resources: OpenshiftResource[] = [];

        for (const resourceKind of resourceKindsRequired) {
            const result = await this.openShiftApi.get.get(`${_.toLower(resourceKind)}`, "", projectIdNameSpace);
            if (isSuccessCode(result.status)) {
                const items: OpenshiftResource[] = result.data.items.map(resource => {
                    resource.kind = resourceKind;
                    resource.apiVersion = "v1";
                    return resource;
                });
                resources.push(...items);
            } else {
                logger.error(`Failed to export all resources ${resourceKind} in namespace: ${projectIdNameSpace}, ${inspect(result)}`);
                throw new QMError(`Failed to export all resources ${resourceKind} in namespace: ${projectIdNameSpace}`);
            }
        }

        return {
            kind: "List",
            apiVersion: "v1",
            metadata: {},
            items: resources,
        };
    }

    public async patchResourceInNamespace(resourcePatch: OpenshiftResource, namespace: string, deleteMetaData: boolean = true) {

        const response = await this.openShiftApi.patch.patch(resourcePatch, namespace, deleteMetaData);

        if (!isSuccessCode(response.status)) {
            logger.error(`Failed to patch requested resource.\nResource: ${JSON.stringify(resourcePatch)}`);
            if (!_.isEmpty(response.data.items)) {
                for (const item of response.data.items) {
                    if (!isSuccessCode(item.status)) {
                        logger.error(`Resource Failed: ${inspect(item.data)}`);
                    }
                }
            } else {
                logger.error(`Resource Failed: ${inspect(response)}`);
            }
            throw new QMError("Failed to patch requested resource");
        }

        return response;
    }

}
