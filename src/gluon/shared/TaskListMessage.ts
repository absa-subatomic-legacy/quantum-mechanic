import {HandlerContext, HandlerResult} from "@atomist/automation-client";
import {Attachment, SlackMessage} from "@atomist/slack-messages";
import {v4 as uuid} from "uuid";
import {QMMessageClient} from "./Error";

export class TaskListMessage {

    private statusImages = new Map<TaskStatus, string>();
    private readonly messageId: string;
    private readonly tasks: { [k: string]: Task };
    private readonly taskOrder: string[];

    constructor(private titleMessage, private messageClient: QMMessageClient) {
        this.messageId = uuid();
        this.tasks = {};
        this.taskOrder = [];
        this.statusImages.set(TaskStatus.Pending, "✴️");
        this.statusImages.set(TaskStatus.Failed, "❌");
        this.statusImages.set(TaskStatus.Successful, "✅");
    }

    public addTask(key: string, description: string) {
        this.tasks[key] = {description, status: TaskStatus.Pending};
        this.taskOrder.push(key);
    }

    public async setTaskStatus(key: string, status: TaskStatus): Promise<HandlerResult> {
        this.tasks[key].status = status;
        return await this.display();
    }

    public failRemainingTasks(): Promise<HandlerResult> {
        this.taskOrder.map(taskName => {
            if (this.tasks[taskName].status === TaskStatus.Pending) {
                this.tasks[taskName].status = TaskStatus.Failed;
            }
        });
        return this.display();
    }

    public display(): Promise<HandlerResult> {
        return this.messageClient.send(this.generateMessage(), {id: this.messageId});
    }

    private generateMessage() {
        const message: SlackMessage = {
            text: this.titleMessage,
            attachments: [],
        };
        let messageText = "";
        for (const key of this.taskOrder) {
            const task = this.tasks[key];
            const statusImage = this.statusImages.get(task.status);
            messageText += `${statusImage} ${task.description}\n`;
        }
        message.attachments.push({text: `${messageText}`} as Attachment);
        return message;
    }
}

interface Task {
    description: string;
    status: number;
}

export enum TaskStatus {
    Pending,
    Successful,
    Failed,
}
