export class BaseQMCommand {
    get commandResult() {
        if (this.result === undefined) {
            this.result = CommandResultStatus.unset;
        }
        return this.result;
    }

    set commandResult(value) {
        this.result = value;
    }

    get resultMessage() {
        if (this.message === undefined) {
            this.message = "";
        }
        return this.message;
    }

    set resultMessage(value) {
        this.message = value;
    }

    private result;
    private message: string;

    public succeedCommand(message?: string) {
        this.commandResult = CommandResultStatus.success;
        this.resultMessage = message;
    }

    public failCommand(message?: string) {
        this.commandResult = CommandResultStatus.failure;
        this.resultMessage = message;
    }

}

export enum CommandResultStatus {
    unset = "unset",
    success = "success",
    failure = "failure",
}
