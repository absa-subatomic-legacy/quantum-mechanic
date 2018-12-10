import {HandlerContext, logger} from "@atomist/automation-client";
import {inspect} from "util";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {isSuccessCode} from "../../../http/Http";
import {OCService} from "../../services/openshift/OCService";
import {
    getProjectId,
    OpenshiftProjectEnvironmentRequest,
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
            this.environmentsRequestedEvent.project.name);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_POD_NETWORK);
        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

    private async createOpenshiftEnvironments() {
        const environments = [];
        for (const environment of this.openshiftEnvironment.defaultEnvironments) {
            environments.push([environment.id, environment.description]);
        }

        await this.ocService.login(this.openshiftEnvironment, true);

        for (const environment of environments) {
            const projectNamespaceId = getProjectId(this.environmentsRequestedEvent.owningTenant.name, this.environmentsRequestedEvent.project.name, environment[0]);
            logger.info(`Working with OpenShift project Id: ${projectNamespaceId}`);

            await this.createOpenshiftProject(projectNamespaceId, this.environmentsRequestedEvent, environment);
            await this.taskListMessage.succeedTask(this.dynamicTaskNameStore[`${environment[0]}Environment`]);
        }
    }

    private async createOpenshiftProject(projectNamespaceId: string, environmentsRequestedEvent: OpenshiftProjectEnvironmentRequest, environment) {
        try {
            await this.ocService.newSubatomicProject(
                projectNamespaceId,
                environmentsRequestedEvent.project.name,
                environmentsRequestedEvent.owningTenant.name,
                environment);
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

    private async createPodNetwork(tenantName: string, projectName: string) {
        const teamDevOpsProjectId = this.devopsEnvironmentDetails.openshiftProjectId;
        for (const environment of this.openshiftEnvironment.defaultEnvironments) {
            const projectEnvironment = getProjectId(tenantName, projectName, environment.id);
            const createPodNetworkResult = await this.ocService.createPodNetwork(projectEnvironment, teamDevOpsProjectId);

            if (!isSuccessCode(createPodNetworkResult.status)) {
                const errorResponse = createPodNetworkResult.data;
                if (createPodNetworkResult.status === 404 && errorResponse.details.kind === "clusternetworks") {
                    logger.warn("Openshift multitenant network plugin not found. Assuming running on Minishift test environment");
                    break;
                } else {
                    logger.error(`Failed to join project ${projectEnvironment} to ${teamDevOpsProjectId}: ${inspect(createPodNetworkResult)}`);
                    throw new QMError(`Failed to join project ${projectEnvironment} to ${teamDevOpsProjectId}`);
                }
            } else {
                logger.info(`Successfully joined project ${projectEnvironment} to ${teamDevOpsProjectId}`);
            }
        }
    }

}
