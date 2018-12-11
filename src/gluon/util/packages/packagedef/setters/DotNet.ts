import {EnvironmentVariableCommandTemplate} from "../SetterLoader";

export function setSolutionName(command: EnvironmentVariableCommandTemplate): Array<{ value: string, text: string }> {
    // This is currently a place holder and needs updating for actual dot net solution usage
    return [
        {
            value: "Test1",
            text: "Test1",
        },
        {
            value: "Test2",
            text: "Test2",
        },
    ];
}
