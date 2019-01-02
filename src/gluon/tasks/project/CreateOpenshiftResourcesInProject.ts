import {HandlerContext} from "@atomist/automation-client";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {OpenshiftResource} from "../../../openshift/api/resources/OpenshiftResource";
import {OCService} from "../../services/openshift/OCService";
import {OpenShiftProjectNamespace} from "../../util/project/Project";
import {QMError} from "../../util/shared/Error";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class CreateOpenshiftResourcesInProject extends Task {

    private dynamicTaskNameStore: { [k: string]: string } = {};

    constructor(private environmentsForResources: OpenShiftProjectNamespace[],
                private openshiftResources: OpenshiftResource,
                private openshiftEnvironment: OpenShiftConfig,
                private ocService = new OCService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        for (const environment of this.environmentsForResources) {
            const internalTaskId = `${environment.postfix}Environment`;
            const projectName = environment.namespace;
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

        for (const environment of this.environmentsForResources) {
            await this.ocService.applyResourceFromDataInNamespace(this.openshiftResources, environment.namespace, true);
            await this.taskListMessage.succeedTask(this.dynamicTaskNameStore[`${environment.postfix}Environment`]);
        }

    }
}
