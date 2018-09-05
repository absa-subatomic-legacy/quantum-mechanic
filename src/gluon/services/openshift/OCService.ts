import {logger} from "@atomist/automation-client";
import * as fs from "fs";
import _ = require("lodash");
import {inspect} from "util";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {OpenshiftApiResult} from "../../../openshift/api/base/OpenshiftApiResult";
import {OpenShiftApi} from "../../../openshift/api/OpenShiftApi";
import {OpenshiftResource} from "../../../openshift/api/resources/OpenshiftResource";
import {OCCommandResult} from "../../../openshift/base/OCCommandResult";
import {AbstractOption} from "../../../openshift/base/options/AbstractOption";
import {NamedSimpleOption} from "../../../openshift/base/options/NamedSimpleOption";
import {SimpleOption} from "../../../openshift/base/options/SimpleOption";
import {StandardOption} from "../../../openshift/base/options/StandardOption";
import {OCClient} from "../../../openshift/OCClient";
import {OCCommon} from "../../../openshift/OCCommon";
import {getProjectDisplayName} from "../../util/project/Project";
import {BaseProjectTemplateLoader} from "../../util/resources/BaseProjectTemplateLoader";
import {QuotaLoader} from "../../util/resources/QuotaLoader";
import {QMError, QMErrorType} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";
import {OCImageService} from "./OCImageService";

export class OCService {

    public openShiftApi: OpenShiftApi;

    private quotaLoader: QuotaLoader = new QuotaLoader();
    private baseProjectTemplateLoader: BaseProjectTemplateLoader = new BaseProjectTemplateLoader();

    constructor(private ocImageService = new OCImageService()) {
    }

    public async login(openshiftDetails: OpenShiftConfig = QMConfig.subatomic.openshiftNonProd) {
        this.openShiftApi = new OpenShiftApi(openshiftDetails);
        this.ocImageService.openShiftApi = this.openShiftApi;
        return await OCClient.login(openshiftDetails.masterUrl, openshiftDetails.auth.token);
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

    public async newSubatomicProject(openshiftProjectId: string, projectName: string, owningTenant: string, environment: string[], rawResult = false): Promise<any> {
        logger.debug(`Trying to create new Subatomic Project. openshiftProjectId: ${openshiftProjectId}; projectName: ${projectName}; environment: ${JSON.stringify(environment)} `);

        const createResult = await this.openShiftApi.newProject(openshiftProjectId,
            getProjectDisplayName(owningTenant, projectName, environment[0]),
            `${environment[1]} environment for ${projectName} [managed by Subatomic]`);
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
        const createResult = await this.openShiftApi.create.create(
            this.quotaLoader.getDevOpsDefaultResourceQuota(),
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
    }

    public async createDevOpsDefaultLimits(openshiftProjectId: string, apply = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create DevOps default limits. openshiftProjectId: ${openshiftProjectId}`);

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
    }

    public async createProjectDefaultResourceQuota(openshiftProjectId: string, apply = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create project default resource quota. openshiftProjectId: ${openshiftProjectId}`);

        const createResult = await this.openShiftApi.create.create(
            this.quotaLoader.getProjectDefaultResourceQuota(),
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
    }

    public async createProjectDefaultLimits(openshiftProjectId: string, apply = true, rawResult = false): Promise<any> {
        logger.debug(`Trying to create project default limits. openshiftProjectId: ${openshiftProjectId}`);

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
    }

    public async getSubatomicTemplate(templateName: string): Promise<OCCommandResult> {
        logger.debug(`Trying to get subatomic template. templateName: ${templateName}`);
        return await OCCommon.commonCommand("get", "templates",
            [templateName],
            [
                new SimpleOption("-namespace", "subatomic"),
                new SimpleOption("-output", "json"),
            ],
        );
    }

    public async getSubatomicAppTemplates(namespace = "subatomic"): Promise<OCCommandResult> {
        logger.debug(`Trying to get subatomic templates. namespace: ${namespace}`);
        return await OCCommon.commonCommand("get", "templates",
            [],
            [
                new SimpleOption("l", "usage=subatomic-app"),
                new SimpleOption("-namespace", namespace),
                new SimpleOption("-output", "json"),
            ],
        );
    }

    public async getJenkinsTemplate(): Promise<OCCommandResult> {
        logger.debug(`Trying to get jenkins template.`);
        return await OCCommon.commonCommand("get", "templates",
            ["jenkins-persistent-subatomic"],
            [
                new SimpleOption("-namespace", "subatomic"),
                new SimpleOption("-output", "json"),
            ],
        );
    }

    public async getSubatomicImageStreamTags(namespace = "subatomic") {
        return this.ocImageService.getSubatomicImageStreamTags(namespace);
    }

    public async applyResourceFromDataInNamespace(resourceDefinition: OpenshiftResource, projectNamespace: string, applyNotReplace: boolean = false): Promise<OpenshiftApiResult> {
        logger.debug(`Trying to create resource from data in namespace. projectNamespace: ${projectNamespace}`);

        let response: OpenshiftApiResult;
        if (applyNotReplace) {
            response = await this.openShiftApi.create.apply(resourceDefinition, projectNamespace);
        } else {
            response = await this.openShiftApi.create.replace(resourceDefinition, projectNamespace);
        }

        if (!isSuccessCode(response.status)) {
            logger.error(`Failed to create requested resource: ${inspect(response, undefined, 4)}`);
            throw new QMError("Failed to create requested resource");
        }

        return response;
    }

    public async tagSubatomicImageToNamespace(imageStreamTagName: string, destinationProjectNamespace: string, destinationImageStreamTagName: string = imageStreamTagName): Promise<OCCommandResult> {
        return await this.ocImageService.tagImageToNamespace("subatomic", imageStreamTagName, destinationProjectNamespace, destinationImageStreamTagName);
    }

    public async tagAllSubatomicImageStreamsToDevOpsEnvironment(devopsProjectId) {
        const imageStreamTagsResult = await this.getSubatomicImageStreamTags();
        const imageStreamTags = JSON.parse(imageStreamTagsResult.output).items;

        await this.ocImageService.tagAllImagesToNamespace("subatomic", imageStreamTags.map(item => item.metadata.name), devopsProjectId);
    }

    public async processJenkinsTemplateForDevOpsProject(devopsNamespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to process jenkins template for devops project template. devopsNamespace: ${devopsNamespace}`);
        const parameters = [
            `NAMESPACE=${devopsNamespace}`,
            "JENKINS_IMAGE_STREAM_TAG=jenkins-subatomic:2.0",
            "BITBUCKET_NAME=Subatomic Bitbucket",
            `BITBUCKET_URL=${QMConfig.subatomic.bitbucket.baseUrl}`,
            `BITBUCKET_CREDENTIALS_ID=${devopsNamespace}-bitbucket`,
            // TODO this should be a property on Team. I.e. teamEmail
            "JENKINS_ADMIN_EMAIL=subatomic@local",
            // TODO the registry Cluster IP we will have to get by introspecting the registry Service
            // If no team email then the address of the createdBy member
            `MAVEN_SLAVE_IMAGE=${QMConfig.subatomic.openshiftNonProd.dockerRepoUrl}/${devopsNamespace}/jenkins-slave-maven-subatomic:2.0`,
            `NODEJS_SLAVE_IMAGE=${QMConfig.subatomic.openshiftNonProd.dockerRepoUrl}/${devopsNamespace}/jenkins-slave-nodejs-subatomic:2.0`,
        ];
        return await this.processOpenshiftTemplate("jenkins-persistent-subatomic", devopsNamespace, parameters);
    }

    public async processOpenshiftTemplate(templateName: string, namespace: string, parameters: string[], ignoreUnknownParameters: boolean = false) {
        logger.debug(`Trying to process openshift template in namespace. templateName: ${templateName}; namespace: ${namespace}, paramaters: ${JSON.stringify(parameters)}`);
        const commandOptions: AbstractOption[] = [];
        if (ignoreUnknownParameters) {
            commandOptions.push(new StandardOption("ignore-unknown-parameters", "true"));
        }

        for (const parameter of parameters) {
            commandOptions.push(new SimpleOption("p", parameter));
        }

        commandOptions.push(new SimpleOption("-namespace", namespace));

        return await OCCommon.commonCommand("process",
            templateName,
            [],
            commandOptions,
        );
    }

    public async getDeploymentConfigInNamespace(dcName: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to get dc in namespace. dcName: ${dcName}, namespace: ${namespace}`);
        return await OCCommon.commonCommand("get", `dc/${dcName}`, [],
            [
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async rolloutDeploymentConfigInNamespace(dcName: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to rollout dc in namespace. dcName: ${dcName}, namespace: ${namespace}`);
        return await OCCommon.commonCommand(
            "rollout status",
            `dc/${dcName}`,
            [],
            [
                new SimpleOption("-namespace", namespace),
                new SimpleOption("-watch=false"),
            ], true);
    }

    public async getServiceAccountToken(serviceAccountName: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to get service account token in namespace. serviceAccountName: ${serviceAccountName}, namespace: ${namespace}`);
        return await OCCommon.commonCommand("serviceaccounts",
            "get-token",
            [
                serviceAccountName,
            ], [
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async annotateJenkinsRoute(namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to annotate jenkins route in namespace. namespace: ${namespace}`);
        return await OCCommon.commonCommand("annotate route",
            "jenkins",
            [],
            [
                new SimpleOption("-overwrite", "haproxy.router.openshiftNonProd.io/timeout=120s"),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async getJenkinsHost(namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to get jenkins host in namespace. namespace: ${namespace}`);
        return await OCCommon.commonCommand(
            "get",
            "route/jenkins",
            [],
            [
                new SimpleOption("-output", "jsonpath={.spec.host}"),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async getSecretFromNamespace(secretName: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to get secret in namespace. secretName: ${secretName}, namespace: ${namespace}`);
        return await OCCommon.commonCommand("get secrets",
            secretName,
            [],
            [
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async createBitbucketSSHAuthSecret(secretName: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to create bitbucket ssh auth secret in namespace. secretName: ${secretName}, namespace: ${namespace}`);

        return await OCCommon.commonCommand("create secret generic",
            secretName,
            [],
            [
                new NamedSimpleOption("-from-file=ssh-privatekey", QMConfig.subatomic.bitbucket.cicdPrivateKeyPath),
                new NamedSimpleOption("-from-file=ca.crt", QMConfig.subatomic.bitbucket.caPath),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async createConfigServerSecret(namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to create config server secret. namespace: ${namespace}`);

        logger.debug("Extracting raw ssh key from cicd key");
        // Ignore the ssh-rsa encoding string, and any user name details at the end.
        const rawSSHKey = QMConfig.subatomic.bitbucket.cicdKey.split(" ")[1];

        return await OCCommon.commonCommand("create secret generic",
            "subatomic-config-server",
            [],
            [
                new NamedSimpleOption("-from-literal=spring.cloud.config.server.git.hostKey", rawSSHKey),
                new NamedSimpleOption("-from-file=spring.cloud.config.server.git.privateKey", QMConfig.subatomic.bitbucket.cicdPrivateKeyPath),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async addTeamMembershipPermissionsToProject(projectId: string, team: QMTeam) {
        logger.debug(`Trying to add team membership permission to project.`);
        await team.owners.map(async owner => {
            const ownerUsername = /[^\\]*$/.exec(owner.domainUsername)[0];
            logger.info(`Adding role to project [${projectId}] and owner [${owner.domainUsername}]: ${ownerUsername}`);
            return await this.openShiftApi.policy.addRoleToUser(ownerUsername, "admin", projectId);
        });
        await team.members.map(async member => {
            const memberUsername = /[^\\]*$/.exec(member.domainUsername)[0];
            await logger.info(`Adding role to project [${projectId}] and member [${member.domainUsername}]: ${memberUsername}`);
            return await this.openShiftApi.policy.addRoleToUser(memberUsername, "view", projectId);
        });
    }

    public async createPodNetwork(projectToJoin: string, projectToJoinTo: string): Promise<OpenshiftApiResult> {
        logger.debug(`Trying to create pod network. projectToJoin: ${projectToJoin}; projectToJoinTo: ${projectToJoinTo}`);

        return this.openShiftApi.adm.podNetworkJoinToProject(projectToJoin, projectToJoinTo);
    }

    public async addRoleToUserInNamespace(user: string, role: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to add role to user in namespace: user: ${user}; role: ${role}; namespace: ${namespace}`);
        return await OCClient.policy.addRoleToUser(user,
            role,
            namespace);
    }

    public async createPVC(pvcName: string, namespace: string): Promise<OCCommandResult> {
        logger.debug(`Trying to create pvc in namespace. pvcName: ${pvcName}; namespace: ${namespace}`);
        return await OCClient.createPvc(pvcName, namespace);
    }

    public async initilizeProjectWithDefaultProjectTemplate(projectId: string, apply = true) {
        const template = this.baseProjectTemplateLoader.getTemplate();
        if (!_.isEmpty(template.objects)) {
            logger.info(`Applying base project template to ${projectId}`);
            const fileName = Date.now() + ".json";
            fs.writeFileSync(`/tmp/${fileName}`, JSON.stringify(template));
            const processedTemplateResult = await OCCommon.commonCommand("process", `-f /tmp/${fileName}`);
            const result = await this.openShiftApi.create.create(JSON.parse(processedTemplateResult.output), projectId, apply);
            if (!isSuccessCode(result.status)) {
                logger.error(`Template failed to create properly: ${inspect(result)}`);
                throw new QMError("Failed to create all items in base project template.");
            }
        } else {
            logger.debug(`Base template is empty. Not applying to project ${projectId}`);
        }
    }

    public async findProject(projectId: string) {
        const listOfProjectsResult = await OCCommon.commonCommand("get", "projects",
            [], [new SimpleOption("-output", "json")]);
        for (const project of JSON.parse(listOfProjectsResult.output).items) {
            if (project.metadata.name === projectId) {
                return project;
            }
        }
        return null;
    }

    public async exportAllResources(projectId: string) {
        const listOfResourcesResult = await OCCommon.commonCommand("export", "all",
            [], [new SimpleOption("-output", "json"), new SimpleOption("-namespace", projectId)]);
        return JSON.parse(listOfResourcesResult.output);
    }
}
