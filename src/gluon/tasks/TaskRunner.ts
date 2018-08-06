import {HandlerContext} from "@atomist/automation-client";
import {TaskListMessage} from "../util/shared/TaskListMessage";
import {Task} from "./Task";

export class TaskRunner {
    private tasks: Task[] = [];

    constructor(private taskListMessage: TaskListMessage) {
    }

    public addTask(task: Task) {
        task.setTaskListMessage(this.taskListMessage);
        this.tasks.push(task);
    }

    public async execute(ctx: HandlerContext) {
        for (const task of this.tasks) {
            if (!await task.execute(ctx)) {
                await this.taskListMessage.failRemainingTasks();
                return false;
            }
        }
        return true;
    }
}
