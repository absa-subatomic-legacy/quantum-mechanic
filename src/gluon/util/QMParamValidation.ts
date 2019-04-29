import {logger} from "@atomist/automation-client";
import {JsonLoader} from "./resources/JsonLoader";

export class QMParamValidation {

    public static paramValidationMap: ParamaterValidationMap;

    public static initialize() {
        this.paramValidationMap = this.readConfigFile();
    }

    public static getPattern(className: string, paramaterName: string, defaultValidation?: string) {
        if (QMParamValidation.paramValidationMap && QMParamValidation.paramValidationMap[className + "_" + paramaterName]) {
            return RegExp(QMParamValidation.paramValidationMap[className + "_" + paramaterName]);
        } else {
            return RegExp(defaultValidation);
        }
    }

    private static readConfigFile(): any {
        let valObj = {};
        try {
            valObj = new JsonLoader().readFileContents("config/validation.json");
            logger.info(`Successfully read custom validation JSON file`);

        } catch (e) {
            logger.warn(`Did not find custom validation JSON file in config/ directory. ${e.message}. Will use default validation patterns.`);
        }
        return valObj;
    }
}

interface ParamaterValidationMap {
    [key: string]: RegExp;
}

QMParamValidation.initialize();
