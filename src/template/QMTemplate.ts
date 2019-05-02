import * as Handlebars from "handlebars";
import _ = require("lodash");
import SafeString = Handlebars.SafeString;

export class QMTemplate {

    private readonly template: HandlebarsTemplateDelegate;

    constructor(rawTemplateString: string) {
        Handlebars.registerHelper("toLowerCase", str => str.toLowerCase());
        Handlebars.registerHelper("toUpperCase", str => str.toUpperCase());
        Handlebars.registerHelper("toKebabCase", str => _.kebabCase(str));
        Handlebars.registerHelper("toCamelCase", str => _.camelCase(str));
        Handlebars.registerHelper("toPascalCase", str => _.upperFirst(_.camelCase(str)));
        Handlebars.registerHelper("toUpperSnakeCase", str => _.snakeCase(str).toUpperCase());
        Handlebars.registerHelper("toLowerKebabCase", str => _.kebabCase(str).toLowerCase());
        Handlebars.registerHelper("ifCond", ifCond);
        this.template = Handlebars.compile(rawTemplateString);
    }

    public build(parameters: { [k: string]: any }): string {
        const safeParameters: { [k: string]: any } = Object.assign([], _.cloneDeep(parameters));
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

function ifCond(v1Input, operator, v2Input, options) {
    // A function that adds equality and logical checks helper functions to
    // the handlebars templating.
    // See https://stackoverflow.com/a/16315366/1630111
    let v1 = v1Input;
    if (v1Input instanceof SafeString) {
        v1 = v1Input.toString();
    }

    let v2 = v2Input;
    if (v2Input instanceof SafeString) {
        v2 = v2Input.toString();
    }

    switch (operator) {
        case "==":
            // @ts-ignore
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case "!=":
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
