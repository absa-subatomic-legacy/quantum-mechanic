import * as Handlebars from "handlebars";
import _ = require("lodash");

export class QMTemplate {

    private readonly template: HandlebarsTemplateDelegate;

    constructor(templateFile: string) {
        const fs = require("fs");
        const buffer = fs.readFileSync(templateFile);
        Handlebars.registerHelper("toLowerCase", str => str.toLowerCase());
        Handlebars.registerHelper("toUpperCase", str => str.toUpperCase());
        Handlebars.registerHelper("toKebabCase", str => _.kebabCase(str));
        Handlebars.registerHelper("toCamelCase", str => _.camelCase(str));
        Handlebars.registerHelper("toPascalCase", str => _.capitalize(_.camelCase(str)));
        Handlebars.registerHelper("toUpperSnakeCase", str => _.snakeCase(str).toUpperCase());
        this.template = Handlebars.compile(buffer.toString());
    }

    public build(parameters: { [k: string]: any }): string {
        const safeParameters: { [k: string]: any } = Object.assign([], parameters);
        this.toSafeStrings(safeParameters);
        return this.template(safeParameters);
    }

    public toSafeStrings(obj: any) {
        for (const property in obj) {
            if (obj.hasOwnProperty(property)) {
                if (typeof obj[property] === "object") {
                    return this.toSafeStrings(obj[property]);
                } else {
                    obj[property] = new Handlebars.SafeString(obj[property]);
                }
            }
        }
    }
}
