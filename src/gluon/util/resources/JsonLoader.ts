import {QMFileTemplate} from "../../../template/QMTemplate";

export class JsonLoader {
    public readFileContents(filePath: string): any {
        const fs = require("fs");
        const buffer = fs.readFileSync(filePath);
        return JSON.parse(buffer.toString());
    }

    public readTemplatizedFileContents(filePath: string, parameters: { [k: string]: any }): any {
        const template = new QMFileTemplate(filePath);
        return JSON.parse(template.build(parameters));
    }
}
