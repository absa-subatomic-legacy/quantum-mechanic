import {HandlerContext} from "@atomist/automation-client";
import {QMError} from "../util/shared/Error";
import {TaskListMessage} from "./TaskListMessage";

export abstract class Task {

    protected taskListMessage: TaskListMessage;

    public async execute(ctx: HandlerContext): Promise<boolean> {
        if (this.taskListMessage === undefined) {
            throw new QMError("TaskListMessage is undefined. Cannot start taskRunner.");
        }
        return await this.executeTask(ctx);
    }

    public setTaskListMessage(taskListMessage: TaskListMessage, indentation: number) {
        this.taskListMessage = taskListMessage;
        const startTask = this.taskListMessage.countTasks();
        this.configureTaskListMessage(taskListMessage);
        const lastTask = this.taskListMessage.countTasks();
        for (let i = startTask; i < lastTask - 1; i++) {
            this.taskListMessage.indentTaskAtIndex(i, indentation);
        }
    }

    protected abstract async executeTask(ctx: HandlerContext): Promise<boolean>;

    protected abstract configureTaskListMessage(taskListMessage: TaskListMessage);
}
