import {logger} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {OCCommandResult} from "../../../openshift/base/OCCommandResult";
import {SimpleOption} from "../../../openshift/base/options/SimpleOption";
import {OCClient} from "../../../openshift/OCClient";
import {OCCommon} from "../../../openshift/OCCommon";

export class OCService {

    public async newDevOpsProject(openshiftProjectId: string, teamName: string): Promise<OCCommandResult> {
        return await OCClient.newProject(openshiftProjectId,
            `${teamName} DevOps`,
            `DevOps environment for ${teamName} [managed by Subatomic]`);
    }

    public async createDefaultResourceQuota(openshiftProjectId: string): Promise<OCCommandResult> {
        return await OCCommon.createFromData({
            apiVersion: "v1",
            kind: "ResourceQuota",
            metadata: {
                name: "default-quota",
            },
            spec: {
                hard: {
                    "limits.cpu": "16", // 4 * 4m
                    "limits.memory": "4096Mi", // 4 * 1024Mi
                    "pods": "4",
                },
            },
        }, [
            new SimpleOption("-namespace", openshiftProjectId),
        ]);
    }

    public async createDefaultLimits(openshiftProjectId: string): Promise<OCCommandResult> {
        return await OCCommon.createFromData({
            apiVersion: "v1",
            kind: "LimitRange",
            metadata: {
                name: "default-limits",
            },
            spec: {
                limits: [{
                    type: "Container",
                    max: {
                        cpu: "4",
                        memory: "1024Mi",
                    },
                    default: {
                        cpu: "4",
                        memory: "1024Mi",
                    },
                    defaultRequest: {
                        cpu: "0",
                        memory: "0Mi",
                    },
                }],
            },
        }, [
            new SimpleOption("-namespace", openshiftProjectId),
        ]);
    }

    public async getSubatomicAppTemplates(): Promise<OCCommandResult> {
        return await OCCommon.commonCommand("get", "templates",
            [],
            [
                new SimpleOption("l", "usage=subatomic-app"),
                new SimpleOption("-namespace", "subatomic"),
                new SimpleOption("-output", "json"),
            ],
        );
    }

    public async getJenkinsTemplate(): Promise<OCCommandResult> {
        return await OCCommon.commonCommand("get", "templates",
            ["jenkins-persistent-subatomic"],
            [
                new SimpleOption("-namespace", "subatomic"),
                new SimpleOption("-output", "json"),
            ],
        );
    }

    public async createResourceFromDataInNamespace(resourceDefinition: any, projectNamespace: string, applyNotReplace: boolean = false): Promise<OCCommandResult> {
        return await OCCommon.createFromData(resourceDefinition,
            [
                new SimpleOption("-namespace", projectNamespace),
            ]
            , applyNotReplace);
    }

    public async tagSubatomicImageToNamespace(imageStreamTagName: string, destinationProjectNamespace: string): Promise<OCCommandResult> {
        return await OCCommon.commonCommand("tag",
            `subatomic/${imageStreamTagName}`,
            [`${destinationProjectNamespace}/${imageStreamTagName}`]);
    }

    public async processJenkinsTemplateForDevOpsProject(devopsNamespace: string): Promise<OCCommandResult> {
        return await OCCommon.commonCommand("process",
            "jenkins-persistent-subatomic",
            [],
            [
                new SimpleOption("p", `NAMESPACE=${devopsNamespace}`),
                new SimpleOption("p", "JENKINS_IMAGE_STREAM_TAG=jenkins-subatomic:2.0"),
                new SimpleOption("p", "BITBUCKET_NAME=Subatomic Bitbucket"),
                new SimpleOption("p", `BITBUCKET_URL=${QMConfig.subatomic.bitbucket.baseUrl}`),
                new SimpleOption("p", `BITBUCKET_CREDENTIALS_ID=${devopsNamespace}-bitbucket`),
                // TODO this should be a property on Team. I.e. teamEmail
                // If no team email then the address of the createdBy member
                new SimpleOption("p", "JENKINS_ADMIN_EMAIL=subatomic@local"),
                // TODO the registry Cluster IP we will have to get by introspecting the registry Service
                new SimpleOption("p", `MAVEN_SLAVE_IMAGE=${QMConfig.subatomic.openshift.dockerRepoUrl}/${devopsNamespace}/jenkins-slave-maven-subatomic:2.0`),
                new SimpleOption("p", `NODEJS_SLAVE_IMAGE=${QMConfig.subatomic.openshift.dockerRepoUrl}/${devopsNamespace}/jenkins-slave-nodejs-subatomic:2.0`),
                new SimpleOption("-namespace", devopsNamespace),
            ],
        );
    }

    public async getDeploymentConfigInNamespace(dcName: string, namespace: string): Promise<OCCommandResult> {
        return await OCCommon.commonCommand("get", `dc/${dcName}`, [],
            [
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async rolloutDeploymentConfigInNamespace(dcName: string, namespace: string): Promise<OCCommandResult> {
        return await OCCommon.commonCommand(
            "rollout status",
            `dc/${dcName}`,
            [],
            [
                new SimpleOption("-namespace", namespace),
                new SimpleOption("-watch=false"),
            ], true);
    }

    public async getServiceAccountToken(serviceAccountName: string, namespace: string) {
        return await OCCommon.commonCommand("serviceaccounts",
            "get-token",
            [
                serviceAccountName,
            ], [
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async annotateJenkinsRoute(namespace: string) {
        return await OCCommon.commonCommand("annotate route",
            "jenkins",
            [],
            [
                new SimpleOption("-overwrite", "haproxy.router.openshift.io/timeout=120s"),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async getJenkinsRoute(namespace: string) {
        return await OCCommon.commonCommand(
            "get",
            "route/jenkins",
            [],
            [
                new SimpleOption("-output", "jsonpath={.spec.host}"),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async getSecretFromNamespace(secretName: string, namespace: string) {
        return await OCCommon.commonCommand("get secrets",
            secretName,
            [],
            [
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async createBitbucketSSHAuthSecret(secretName: string, namespace: string) {
        return await OCCommon.commonCommand("secrets new-sshauth",
            secretName,
            [],
            [
                new SimpleOption("-ssh-privatekey", QMConfig.subatomic.bitbucket.cicdPrivateKeyPath),
                new SimpleOption("-ca-cert", QMConfig.subatomic.bitbucket.caPath),
                new SimpleOption("-namespace", namespace),
            ]);
    }

    public async addTeamMembershipPermissionsToProject(projectId: string, team: { owners: Array<{ domainUsername }>, members: Array<{ domainUsername }> }) {
        await team.owners.map(async owner => {
            const ownerUsername = /[^\\]*$/.exec(owner.domainUsername)[0];
            logger.info(`Adding role to project [${projectId}] and owner [${owner.domainUsername}]: ${ownerUsername}`);
            return await OCClient.policy.addRoleToUser(ownerUsername,
                "admin",
                projectId);
        });
        await team.members.map(async member => {
            const memberUsername = /[^\\]*$/.exec(member.domainUsername)[0];
            await logger.info(`Adding role to project [${projectId}] and member [${member.domainUsername}]: ${memberUsername}`);
            return await OCClient.policy.addRoleToUser(memberUsername,
                "view",
                projectId);
        });
    }
}
