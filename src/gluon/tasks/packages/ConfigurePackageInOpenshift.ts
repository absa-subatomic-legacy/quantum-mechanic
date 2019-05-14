import {
    HandlerContext,
    HandlerResult,
    logger,
    success,
} from "@atomist/automation-client";
import * as _ from "lodash";
import {OpenshiftListResource, OpenshiftResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {QMConfig} from "../../../config/QMConfig";

import {QMTemplate} from "../../../template/QMTemplate";
import {ImageStream} from "../../events/packages/package-configuration-request/PackageConfigurationRequestedEvent";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {
    ApplicationType,
    getBuildConfigName,
} from "../../util/packages/Applications";
import {
    getAllPipelineOpenshiftNamespacesForAllPipelines,
    getProjectDevOpsId,
    QMProject,
} from "../../util/project/Project";
import {QMError} from "../../util/shared/Error";
import {imageStreamToFullImageStreamTagString} from "../../util/shared/ImageStreamTranformers";
import {getDevOpsEnvironmentDetails, QMTeam} from "../../util/team/Teams";
import {KeyValuePairEvent} from "../../util/transform/types/event/KeyValuePairEvent";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigurePackageInOpenshift extends Task {

    private readonly TASK_CREATE_IMAGE_STREAM = "CreateImageStream";
    private readonly TASK_CREATE_BUILD_CONFIG = "CreateBuildConfig";
    private readonly TASK_ADD_RESOURCES_TO_ENVIRONMENTS = "AddResources";

    constructor(private deploymentDetails: PackageDeploymentDetails,
                private packageDetails: PackageDetails,
                private ocService = new OCService(),
                private gluonService = new GluonService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_CREATE_IMAGE_STREAM, "Create Openshift Image Stream");
        this.taskListMessage.addTask(this.TASK_CREATE_BUILD_CONFIG, "Create Openshift Build Config");
        this.taskListMessage.addTask(this.TASK_ADD_RESOURCES_TO_ENVIRONMENTS, "Add Resources To Deployment Environments");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        if (this.taskListMessage === undefined) {
            throw new QMError("TaskListMessage is undefined.");
        }
        await this.doConfiguration();
        return true;
    }

    private async doConfiguration() {

        const teamDevOpsProjectId = getDevOpsEnvironmentDetails(this.packageDetails.owningTeamName).openshiftProjectId;
        logger.debug(`Using owning team DevOps project: ${teamDevOpsProjectId}`);

        if (this.packageDetails.packageType === ApplicationType.DEPLOYABLE.toString()) {

            const project: QMProject = await this.gluonService.projects.gluonProjectFromProjectName(this.packageDetails.projectName);
            const owningTeam: QMTeam = await this.gluonService.teams.gluonTeamById(project.owningTeam.teamId);

            if (this.deploymentDetails.baseS2IImage.namespace === undefined) {
                this.deploymentDetails.baseS2IImage.namespace = QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].sharedResourceNamespace;
            }

            await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].openshiftNonProd);
            const appBuildName = getBuildConfigName(this.packageDetails.projectName, this.packageDetails.packageName);
            await this.createApplicationImageStream(appBuildName, teamDevOpsProjectId);

            await this.taskListMessage.succeedTask(this.TASK_CREATE_IMAGE_STREAM);

            await this.createApplicationBuildConfig(this.packageDetails.bitbucketRepoRemoteUrl, appBuildName, this.deploymentDetails.baseS2IImage, teamDevOpsProjectId);

            await this.taskListMessage.succeedTask(this.TASK_CREATE_BUILD_CONFIG);

            logger.info(`Trying to find tenant: ${project.owningTenant}`);
            const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);
            logger.info(`Found tenant: ${tenant}`);
            await this.createApplicationOpenshiftResources(tenant.name, project, this.packageDetails.packageName, QMConfig.subatomic.openshiftClouds[owningTeam.openShiftCloud].sharedResourceNamespace);

            await this.taskListMessage.succeedTask(this.TASK_ADD_RESOURCES_TO_ENVIRONMENTS);
        }
    }

    private async createApplicationImageStream(appBuildName: string, teamDevOpsProjectId: string) {
        await this.ocService.applyResourceFromDataInNamespace({
            apiVersion: "v1",
            kind: "ImageStream",
            metadata: {
                name: appBuildName,
            },
        }, teamDevOpsProjectId);
    }

    private getBuildConfigData(bitbucketRepoRemoteUrl: string, appBuildName: string, baseS2IImage: ImageStream): OpenshiftResource {
        return {
            apiVersion: "v1",
            kind: "BuildConfig",
            metadata: {
                name: appBuildName,
            },
            spec: {
                failedBuildsHistoryLimit: 3,
                successfulBuildsHistoryLimit: 2,
                resources: {
                    limits: {
                        cpu: "0",
                        memory: "0",
                    },
                },
                source: {
                    type: "Git",
                    git: {
                        // temporary hack because of the NodePort
                        // TODO remove this!
                        uri: `${bitbucketRepoRemoteUrl.replace("7999", String(QMConfig.subatomic.bitbucket.sshPort))}`,
                        ref: "master",
                    },
                    sourceSecret: {
                        name: "bitbucket-ssh",
                    },
                },
                strategy: {
                    sourceStrategy: {
                        from: {
                            kind: "ImageStreamTag",
                            name: imageStreamToFullImageStreamTagString(baseS2IImage),
                            namespace: baseS2IImage.namespace,
                        },
                        env: [],
                    },
                },
                output: {
                    to: {
                        kind: "ImageStreamTag",
                        name: `${appBuildName}:latest`,
                    },
                },
            },
        };
    }

    private async createApplicationBuildConfig(bitbucketRepoRemoteUrl: string, appBuildName: string, baseS2IImage: ImageStream, teamDevOpsProjectId: string) {

        logger.info(`Using Git URI: ${bitbucketRepoRemoteUrl}`);
        const buildConfig: OpenshiftResource = this.getBuildConfigData(bitbucketRepoRemoteUrl, appBuildName, baseS2IImage);

        for (const envVariableKeyValuePair of this.deploymentDetails.buildEnvironmentVariables) {
            buildConfig.spec.strategy.sourceStrategy.env.push(
                {
                    name: envVariableKeyValuePair.key,
                    value: envVariableKeyValuePair.value,
                },
            );
        }

        await this.ocService.applyResourceFromDataInNamespace(
            buildConfig,
            teamDevOpsProjectId,
            true);
    }

    private async createApplicationOpenshiftResources(tenantName: string, project: QMProject, applicationName: string, sharedResourceNamespace: string): Promise<HandlerResult> {
        for (const openShiftNamespaceDetails of getAllPipelineOpenshiftNamespacesForAllPipelines(tenantName, project)) {
            const deploymentNamespace = openShiftNamespaceDetails.namespace;
            const appName = `${_.kebabCase(applicationName).toLowerCase()}`;
            const devOpsProjectId = getProjectDevOpsId(this.packageDetails.teamName);
            logger.info(`Processing app [${appName}] Template for: ${deploymentNamespace}`);

            const appBaseTemplate = await this.ocService.getSubatomicTemplate(this.deploymentDetails.openshiftTemplate, sharedResourceNamespace);
            appBaseTemplate.metadata.namespace = deploymentNamespace;
            // await this.ocService.applyResourceFromDataInNamespace(appBaseTemplate, deploymentNamespace);

            const templateParameters = [
                {key: "APP_NAME", value: appName},
                {key: "IMAGE_STREAM_PROJECT", value: deploymentNamespace},
                {key: "DEVOPS_NAMESPACE", value: devOpsProjectId},
            ];

            const appProcessedTemplate: OpenshiftListResource = await this.ocService.findAndProcessOpenshiftTemplate(
                this.deploymentDetails.openshiftTemplate,
                sharedResourceNamespace,
                templateParameters,
                true);

            logger.debug(`Processed app [${appName}] Template: ${JSON.stringify(appProcessedTemplate)}`);

            try {
                await this.ocService.getDeploymentConfigInNamespace(appName, deploymentNamespace);
                logger.warn(`App [${appName}] Template has already been processed, deployment exists`);
            } catch (error) {

                this.addDeploymentEnvironmentVariablesToDeploymentConfigs(
                    appProcessedTemplate,
                    this.deploymentDetails.deploymentEnvironmentVariables,
                    {
                        project,
                        applicationName: appName,
                        openShiftNamespaceDetails,
                    });

                await this.ocService.applyResourceFromDataInNamespace(
                    appProcessedTemplate,
                    deploymentNamespace,
                );
            }
        }
        return await success();
    }

    private addDeploymentEnvironmentVariablesToDeploymentConfigs(processedTemplate: OpenshiftListResource, deploymentEnvironmentVariables: KeyValuePairEvent[], parameters: { [key: string]: any }) {
        for (const resource of processedTemplate.items) {
            if (resource.kind === "DeploymentConfig") {
                for (const container of resource.spec.template.spec.containers) {
                    for (const dcEnvVar of deploymentEnvironmentVariables) {
                        container.env.push({
                            name: dcEnvVar.key,
                            value: new QMTemplate(dcEnvVar.value).build(parameters),
                        });
                    }
                }
            }
        }
    }
}

export interface PackageDeploymentDetails {
    buildEnvironmentVariables: KeyValuePairEvent[];
    deploymentEnvironmentVariables: KeyValuePairEvent[];
    openshiftTemplate: string;
    baseS2IImage: ImageStream;
}

export interface PackageDetails {
    teamName: string;
    projectName: string;
    packageName: string;
    packageType: string;
    bitbucketRepoRemoteUrl: string;
    owningTeamName: string;
}
