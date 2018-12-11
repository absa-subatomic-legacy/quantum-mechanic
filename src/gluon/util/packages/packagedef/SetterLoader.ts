export class SetterLoader {
    private readonly moduleName: string;
    private readonly functionName;

    constructor(setterString: string) {
        this.moduleName = setterString.split("/")[0];
        this.functionName = setterString.split("/")[1];
    }

    public async getLoader(): Promise<(command: EnvironmentVariableCommandTemplate) => Array<{ value: string, text: string }>> {
        const module = await import(`./setters/${this.moduleName}`);
        return module[this.functionName];
    }
}

export interface EnvironmentVariableCommandTemplate {
    teamName: string;
    projectName: string;
    applicationName: string;
}
