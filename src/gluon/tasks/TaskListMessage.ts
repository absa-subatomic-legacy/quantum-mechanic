import {HandlerResult, logger} from "@atomist/automation-client";
import {Attachment, SlackMessage} from "@atomist/slack-messages";
import {v4 as uuid} from "uuid";
import {SimpleQMMessageClient} from "../../context/QMMessageClient";
import {QMColours} from "../util/QMColour";

export class TaskListMessage {

    public static createUniqueTaskName(name: string) {
        return name + uuid();
    }

    private statusCosmetics = new Map<TaskStatus, { color: string, symbol: string }>();
    private readonly messageId: string;
    private readonly tasks: { [k: string]: Task };
    private readonly taskOrder: string[];

    constructor(private titleMessage, private messageClient: SimpleQMMessageClient) {
        this.messageId = uuid();
        this.tasks = {};
        this.taskOrder = [];
        this.statusCosmetics.set(TaskStatus.Pending, {
            color: QMColours.stdMuddyYellow.hex,
            symbol: "●",
        });
        this.statusCosmetics.set(TaskStatus.Failed, {
            color: QMColours.stdReddyMcRedFace.hex,
            symbol: "✗",
        });
        this.statusCosmetics.set(TaskStatus.Successful, {
            color: QMColours.stdGreenyMcAppleStroodle.hex,
            symbol: "✓",
        });
    }

    public addTask(key: string, description: string) {
        this.tasks[key] = {description, status: TaskStatus.Pending};
        this.taskOrder.push(key);
    }

    public countTasks(): number {
        return this.taskOrder.length;
    }

    public indentTaskAtIndex(taskIndex: number, indentation: number) {
        const task: Task = this.tasks[this.taskOrder[taskIndex]];
        const lines = task.description.split("\n");
        let newDescription = "";
        for (const line of lines) {
            const indentationString = "\t".repeat(indentation);
            newDescription += `${indentationString}${line}\n`;
        }
        task.description = newDescription;
    }

    public async succeedTask(key: string) {
        return await this.setTaskStatus(key, TaskStatus.Successful);
    }

    public async setTaskStatus(key: string, status: TaskStatus): Promise<HandlerResult> {
        logger.info(JSON.stringify(this.tasks));
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
        for (const key of this.taskOrder) {
            const task = this.tasks[key];
            const statusCosmetic = this.statusCosmetics.get(task.status);
            const messageText = `${task.description}\n`;
            message.attachments.push({
                text: `${statusCosmetic.symbol} ${messageText}`,
                color: statusCosmetic.color,
            } as Attachment);
        }
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
