import {HandlerContext, logger} from "@atomist/automation-client";
import {inspect} from "util";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {isSuccessCode} from "../../../http/Http";
import {OCService} from "../../services/openshift/OCService";
import {
    getDeploymentEnvironmentNamespacesFromProject,
    getProjectDisplayName,
    getProjectId,
    OpenshiftProjectEnvironmentRequest,
    QMDeploymentEnvironment,
    QMDeploymentPipeline,
    QMProject,
} from "../../util/project/Project";
import {QMError, QMErrorType} from "../../util/shared/Error";
import {
    DevOpsEnvironmentDetails,
    getDevOpsEnvironmentDetails,
} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class CreateOpenshiftEnvironments extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("CreateOpenshiftEnvironments");
    private readonly TASK_CREATE_POD_NETWORK = TaskListMessage.createUniqueTaskName("PodNetwork");
    private dynamicTaskNameStore: { [k: string]: string } = {};

    constructor(private environmentsRequestedEvent: OpenshiftProjectEnvironmentRequest,
                private openshiftEnvironment: OpenShiftConfig,
                private devopsEnvironmentDetails: DevOpsEnvironmentDetails = getDevOpsEnvironmentDetails(environmentsRequestedEvent.teams[0].name),
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_HEADER, `*Create project environments on ${this.openshiftEnvironment.name}*`);
        for (const environment of this.openshiftEnvironment.defaultEnvironments) {
            const internalTaskId = `${environment.id}Environment`;
            this.dynamicTaskNameStore[internalTaskId] = TaskListMessage.createUniqueTaskName(internalTaskId);
            this.taskListMessage.addTask(this.dynamicTaskNameStore[internalTaskId], `\tCreate ${environment.id} Environment`);
        }
        this.taskListMessage.addTask(this.TASK_CREATE_POD_NETWORK, "\tCreate project/devops pod network");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        await this.createOpenshiftEnvironments();

        await this.createPodNetwork(
            this.environmentsRequestedEvent.owningTenant.name,
            this.environmentsRequestedEvent.project);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_POD_NETWORK);
        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

    private async createOpenshiftEnvironments() {
        const pipelines: QMDeploymentPipeline[] = [this.environmentsRequestedEvent.project.devDeploymentPipeline];
        pipelines.push(...this.environmentsRequestedEvent.project.releaseDeploymentPipelines);

        await this.ocService.setOpenShiftDetails(this.openshiftEnvironment);

        for (const pipeline of pipelines) {
            for (const environment of pipeline.environments) {
                // can use pipeline tag here as necessary
                const projectNamespaceId = getProjectId(this.environmentsRequestedEvent.owningTenant.name, this.environmentsRequestedEvent.project.name, environment.postfix);
                const projectDisplayName = getProjectDisplayName(this.environmentsRequestedEvent.owningTenant.name, this.environmentsRequestedEvent.project.name, environment.displayName);
                logger.info(`Working with OpenShift project Id: ${projectNamespaceId}`);

                await this.createOpenshiftProject(projectNamespaceId, projectDisplayName, this.environmentsRequestedEvent, environment);
                await this.taskListMessage.succeedTask(this.dynamicTaskNameStore[`${environment[0]}Environment`]);
            }
        }
    }

    private async createOpenshiftProject(projectNamespaceId: string, projectDisplayName: string, environmentsRequestedEvent: OpenshiftProjectEnvironmentRequest, environment: QMDeploymentEnvironment) {
        try {
            await this.ocService.newSubatomicProject(projectNamespaceId, projectDisplayName, environmentsRequestedEvent.project.name, environment.postfix);
        } catch (error) {
            if (error instanceof QMError && error.errorType === QMErrorType.conflict) {
                logger.warn("OpenShift project requested already exists.");
            } else {
                throw error;
            }
        }

        await this.ocService.initilizeProjectWithDefaultProjectTemplate(projectNamespaceId, environmentsRequestedEvent.project.name);
        await environmentsRequestedEvent.teams.map(async team => {
            await this.ocService.addTeamMembershipPermissionsToProject(projectNamespaceId, team);
        });
        await this.createProjectQuotasAndLimits(projectNamespaceId);
    }

    private async createProjectQuotasAndLimits(projectId: string) {
        await this.ocService.createProjectDefaultResourceQuota(projectId);
        await this.ocService.createProjectDefaultLimits(projectId);
    }

    private async createPodNetwork(tenantName: string, project: QMProject) {
        const teamDevOpsProjectId = this.devopsEnvironmentDetails.openshiftProjectId;
        for (const deploymentNamespace of getDeploymentEnvironmentNamespacesFromProject(tenantName, project)) {
            const createPodNetworkResult = await this.ocService.createPodNetwork(deploymentNamespace, teamDevOpsProjectId);

            if (!isSuccessCode(createPodNetworkResult.status)) {
                const errorResponse = createPodNetworkResult.data;
                if (createPodNetworkResult.status === 404 && errorResponse.details.kind === "clusternetworks") {
                    logger.warn("Openshift multitenant network plugin not found. Assuming running on Minishift test environment");
                    break;
                } else {
                    logger.error(`Failed to join project ${deploymentNamespace} to ${teamDevOpsProjectId}: ${inspect(createPodNetworkResult)}`);
                    throw new QMError(`Failed to join project ${deploymentNamespace} to ${teamDevOpsProjectId}`);
                }
            } else {
                logger.info(`Successfully joined project ${deploymentNamespace} to ${teamDevOpsProjectId}`);
            }
        }
    }

}
