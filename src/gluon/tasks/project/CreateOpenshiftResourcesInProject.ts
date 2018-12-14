import {HandlerContext} from "@atomist/automation-client";
import _ = require("lodash");
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {OpenshiftListResource} from "../../../openshift/api/resources/OpenshiftResource";
import {OCService} from "../../services/openshift/OCService";
import {GenericOpenshiftResourceService} from "../../services/projects/GenericOpenshiftResourceService";
import {getProjectOpenShiftNamespace} from "../../util/project/Project";
import {QMError} from "../../util/shared/Error";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class CreateOpenshiftResourcesInProject extends Task {

    private dynamicTaskNameStore: { [k: string]: string } = {};

    constructor(private projectName: string,
                private tenantName: string,
                private originalNamespace: string,
                private openshiftEnvironment: OpenShiftConfig,
                private openshiftResources: OpenshiftListResource,
                private ocService = new OCService(),
                private genericOpenShiftResourceService = new GenericOpenshiftResourceService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        for (const environment of this.openshiftEnvironment.defaultEnvironments) {
            const internalTaskId = `${environment.id}Environment`;
            const projectName = getProjectOpenShiftNamespace(this.tenantName, this.projectName, environment.id);
            this.dynamicTaskNameStore[internalTaskId] = TaskListMessage.createUniqueTaskName(internalTaskId);
            this.taskListMessage.addTask(this.dynamicTaskNameStore[internalTaskId], `\tCreate resources in *${this.openshiftEnvironment.name} - ${projectName}*`);
        }
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {
        if (this.taskListMessage === undefined) {
            throw new QMError("TaskListMessage is undefined.");
        }
        await this.doConfiguration();
        return true;
    }

    private async doConfiguration() {
        await this.ocService.setOpenShiftDetails(this.openshiftEnvironment);

        for (const environment of this.openshiftEnvironment.defaultEnvironments) {
            const clonedResources = _.cloneDeep(this.openshiftResources);

            const prodProjectId = getProjectOpenShiftNamespace(this.tenantName, this.projectName, environment.id);

            clonedResources.items = this.genericOpenShiftResourceService.migrateDeploymentConfigImageStreamNamespaces(
                this.genericOpenShiftResourceService.cleanAllPromotableResources(clonedResources.items),
                this.originalNamespace,
                prodProjectId,
            );

            await this.ocService.applyResourceFromDataInNamespace(this.openshiftResources, prodProjectId, true);
            await this.taskListMessage.succeedTask(this.dynamicTaskNameStore[`${environment.id}Environment`]);
        }

    }
}
