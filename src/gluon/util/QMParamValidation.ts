import {logger} from "@atomist/automation-client";
import * as fs from "fs";

export class QMParamValidation {

    public static paramValidationMap: ParamaterValidationMap;

    public static initialize() {

        const rawValidationConfig = fs.readFileSync(this.readConfigFile()).toString();
        const validationConfigObject = JSON.parse(rawValidationConfig);

        this.paramValidationMap = validationConfigObject;
    }

    public static getPattern(className: string, paramaterName: string, defaultValidation?: string) {
         if (QMParamValidation.paramValidationMap[className + "_" + paramaterName]) {
            return RegExp(QMParamValidation.paramValidationMap[className + "_" + paramaterName]);
        } else {
            return RegExp(defaultValidation);
        }
    }

    private static readConfigFile() {

        let configFile = "";

        logger.info(`Searching folder for config.validation.json: config/`);
        fs.readdirSync(`config/`).forEach(file => {
            logger.info(`Found file: ${file}`);
            if (file.endsWith("local.validation.json")) {
                configFile = file;
            } else if (file.endsWith("config.validation.json") && configFile !== "local.validation.json") {
                configFile = file;
            }
        });

        if (configFile === "") {
            logger.error("Failed to read validation config file in config/ directory. Exiting.");
            process.exit(1);
        }

        logger.info(`Using validation config file: ${configFile}`);
        return `config/${configFile}`;
    }
}

interface ParamaterValidationMap {
    [key: string]: RegExp;
}

QMParamValidation.initialize();
