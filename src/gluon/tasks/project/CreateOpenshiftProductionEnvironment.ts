import {HandlerContext, logger} from "@atomist/automation-client";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {OCService} from "../../services/openshift/OCService";
import {
    getProjectId,
    OpenshiftProjectEnvironmentRequest,
} from "../../util/project/Project";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class CreateOpenshiftProductionEnvironment extends Task {

    constructor(private prodOpenshiftEnvironment: OpenShiftConfig,
                private requestDetails: OpenshiftProjectEnvironmentRequest,
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        for (const environment of this.prodOpenshiftEnvironment.defaultEnvironments) {
            this.taskListMessage.addTask(`${environment.id}Environment`, `${this.prodOpenshiftEnvironment.name} - Create ${environment.id} Environment`);
        }
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        await this.createOpenshiftEnvironments();

        return true;
    }

    private async createOpenshiftEnvironments() {
        const environments = [];
        for (const environment of QMConfig.subatomic.openshiftNonProd.defaultEnvironments) {
            environments.push([environment.id, environment.description]);
        }

        await this.ocService.login();

        for (const environment of environments) {
            const projectId = getProjectId(this.requestDetails.owningTenant.name, this.requestDetails.project.name, environment[0]);
            logger.info(`Working with OpenShift project Id: ${projectId}`);

            await this.createOpenshiftProject(projectId, this.requestDetails, environment);
            await this.taskListMessage.succeedTask(`${environment[0]}Environment`);
        }
    }

    private async createOpenshiftProject(projectId: string, environmentsRequestedEvent: OpenshiftProjectEnvironmentRequest, environment) {
        try {
            await this.ocService.newSubatomicProject(
                projectId,
                environmentsRequestedEvent.project.name,
                environmentsRequestedEvent.owningTenant.name,
                environment);
        } catch (err) {
            logger.warn(err);
        } finally {
            await this.ocService.initilizeProjectWithDefaultProjectTemplate(projectId);
            await environmentsRequestedEvent.teams.map(async team => {
                await this.ocService.addTeamMembershipPermissionsToProject(projectId, team);
            });
        }

        await this.createProjectQuotasAndLimits(projectId);
    }

    private async createProjectQuotasAndLimits(projectId: string) {
        await this.ocService.createProjectDefaultResourceQuota(projectId);
        await this.ocService.createProjectDefaultLimits(projectId);
    }
}
