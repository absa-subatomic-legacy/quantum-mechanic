import {HandlerContext} from "@atomist/automation-client";
import _ = require("lodash");
import {
    AtomistQMContext,
    isQMContext,
    QMContext,
} from "../../context/QMContext";
import {Task} from "./Task";
import {TaskListMessage} from "./TaskListMessage";

export class TaskRunner {
    private tasks: Array<{ task: Task, taskKey?: string }> = [];

    constructor(private taskListMessage: TaskListMessage) {
    }

    public addTask(task: Task, header?: string, indentation?: number): TaskRunner {
        const taskDetails: { task: Task, taskKey?: string } = {
            task,
        };

        let taskMessageIndentation = 0;

        if (!_.isEmpty(header)) {
            taskDetails.taskKey = TaskListMessage.createUniqueTaskName(header);
            taskMessageIndentation = 1;
            this.taskListMessage.addTask(taskDetails.taskKey, header);
        }

        if (indentation !== undefined) {
            taskMessageIndentation = indentation;
        }

        task.setTaskListMessage(this.taskListMessage, taskMessageIndentation);
        this.tasks.push(taskDetails);
        return this;
    }

    public async execute(ctx: HandlerContext | QMContext) {
        let context: QMContext;
        if (isQMContext(ctx)) {
            context = ctx;
        } else {
            context = new AtomistQMContext(ctx);
        }
        await this.taskListMessage.display();
        try {
            for (const task of this.tasks) {
                if (!await task.task.execute(context)) {
                    await this.taskListMessage.failRemainingTasks();
                    return false;
                } else if (!_.isEmpty(task.taskKey)) {
                    await this.taskListMessage.succeedTask(task.taskKey);
                }
            }
        } catch (error) {
            await this.taskListMessage.failRemainingTasks();
            throw error;
        }
        return true;
    }
}
