import {logger} from "@atomist/automation-client";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {QMContext} from "../../../context/QMContext";
import {OCService} from "../../services/openshift/OCService";
import {QMError, QMErrorType} from "../../util/shared/Error";
import {
    DevOpsEnvironmentDetails,
    getDevOpsEnvironmentDetails,
    } from "../../util/team/Teams";
import {QMTeam} from "../../util/transform/types/gluon/Team";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class CreateTeamDevOpsEnvironment extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("CreateTeamDevOpsEnvironmentHeader");
    private readonly TASK_OPENSHIFT_ENV = TaskListMessage.createUniqueTaskName("OpenshiftEnv");
    private readonly TASK_OPENSHIFT_PERMISSIONS = TaskListMessage.createUniqueTaskName("OpenshiftPermissions");
    private readonly TASK_SECRETS = TaskListMessage.createUniqueTaskName("ConfigSecrets");

    constructor(private team: QMTeam,
                private openshiftEnvironment: OpenShiftConfig,
                private devopsEnvironmentDetails: DevOpsEnvironmentDetails = getDevOpsEnvironmentDetails(team.name),
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_HEADER, `*Create DevOpsEnvironment on ${this.openshiftEnvironment.name}*`);
        taskListMessage.addTask(this.TASK_OPENSHIFT_ENV, `\tCreate DevOps Openshift Project`);
        taskListMessage.addTask(this.TASK_OPENSHIFT_PERMISSIONS, `\tAdd Openshift Permissions`);
        taskListMessage.addTask(this.TASK_SECRETS, `\tAdd Secrets`);
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {
        const projectId = this.devopsEnvironmentDetails.openshiftProjectId;
        logger.info(`Working with OpenShift project Id: ${projectId}`);

        await this.ocService.setOpenShiftDetails(this.openshiftEnvironment);

        await this.createDevOpsEnvironment(projectId, this.team.name);

        await this.taskListMessage.succeedTask(this.TASK_OPENSHIFT_ENV);

        await this.ocService.addTeamMembershipPermissionsToProject(projectId,
            this.team, this.openshiftEnvironment.usernameCase);

        await this.ocService.addRoleToUserInNamespace(
            `system:serviceaccount:${this.devopsEnvironmentDetails.openshiftProjectId}:builder`,
            "system:image-pullers",
            QMConfig.subatomic.openshiftClouds[this.team.openShiftCloud].sharedResourceNamespace);

        await this.taskListMessage.succeedTask(this.TASK_OPENSHIFT_PERMISSIONS);

        await this.addBitbucketSSHSecret(projectId);

        await this.taskListMessage.succeedTask(this.TASK_SECRETS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

    private async createDevOpsEnvironment(projectId: string, teamName: string) {
        try {
            await this.ocService.newDevOpsProject(projectId, teamName);
        } catch (error) {
            if (error instanceof QMError && error.errorType === QMErrorType.conflict) {
                logger.warn("DevOps project already exists. Continuing.");
            } else {
                throw error;
            }
        }

        await this.ocService.createDevOpsDefaultResourceQuota(projectId);

        await this.ocService.createDevOpsDefaultLimits(projectId);

        return {};
    }

    private async addBitbucketSSHSecret(projectId: string) {
        try {
            await this.ocService.getSecretFromNamespace("bitbucket-ssh", projectId);
            logger.warn("Bitbucket SSH secret must already exist");
        } catch (error) {
            await this.ocService.createBitbucketSSHAuthSecret("bitbucket-ssh", projectId);
        }
    }

}
