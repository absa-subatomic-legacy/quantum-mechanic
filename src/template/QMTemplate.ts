import * as Handlebars from "handlebars";
import _ = require("lodash");

export class QMTemplate {

    private readonly template: HandlebarsTemplateDelegate;

    constructor(rawTemplateString: string) {
        Handlebars.registerHelper("toLowerCase", str => str.toLowerCase());
        Handlebars.registerHelper("toUpperCase", str => str.toUpperCase());
        Handlebars.registerHelper("toKebabCase", str => _.kebabCase(str));
        Handlebars.registerHelper("toCamelCase", str => _.camelCase(str));
        Handlebars.registerHelper("toPascalCase", str => _.capitalize(_.camelCase(str)));
        Handlebars.registerHelper("toUpperSnakeCase", str => _.snakeCase(str).toUpperCase());
        Handlebars.registerHelper("ifCond", ifCond);
        this.template = Handlebars.compile(rawTemplateString);
    }

    public build(parameters: { [k: string]: any }): string {
        const safeParameters: { [k: string]: any } = Object.assign([], parameters);
        this.toSafeStrings(safeParameters);
        return this.template(safeParameters);
    }

    private toSafeStrings(obj: any) {
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

function ifCond(v1, operator, v2, options) {
    // A function that adds equality and logical checks helper functions to
    // the handlebars templating.
    // See https://stackoverflow.com/a/16315366/1630111
    switch (operator) {
        case "==":
        case "===":
            // @ts-ignore
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case "!=":
        case "!==":
            // @ts-ignore
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case "<":
            // @ts-ignore
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case "<=":
            // @ts-ignore
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case ">":
            // @ts-ignore
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case ">=":
            // @ts-ignore
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case "&&":
            // @ts-ignore
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case "||":
            // @ts-ignore
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            // @ts-ignore
            return options.inverse(this);
    }
}

export class QMFileTemplate extends QMTemplate {

    constructor(templateFile: string) {
        const fs = require("fs");
        const buffer = fs.readFileSync(templateFile);
        super(buffer.toString());
    }
}
