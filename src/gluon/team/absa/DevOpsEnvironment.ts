import {logger, SuccessPromise} from "@atomist/automation-client";
import {AbsaConfig} from "../../../config/AbsaConfig";
import {SimpleOption} from "../../../openshift/base/options/SimpleOption";
import {OCCommon} from "../../../openshift/OCCommon";

export function createLogstashEndpoint(projectId: string): Promise<any> {
    logger.info("Processing Logstash Template...");
    return OCCommon.commonCommand("process",
        "logstash-endpoint",
        [],
        [
            new SimpleOption("p", `LS_ENDPOINT_HOST_1=${AbsaConfig.logstash.endpointHost1}`),
            new SimpleOption("p", `LS_ENDPOINT_HOST_2=${AbsaConfig.logstash.endpointHost2}`),
            new SimpleOption("p", `LS_ENDPOINT_HOST_3=${AbsaConfig.logstash.endpointHost3}`),
            new SimpleOption("p", `LS_ENDPOINT_HOST_4=${AbsaConfig.logstash.endpointHost4}`),
            new SimpleOption("p", `LS_ENDPOINT_HOST_5=${AbsaConfig.logstash.endpointHost5}`),
            new SimpleOption("-namespace", "openshift"),
        ],
    )
        .then(logstashTemplate => {
            logger.debug(`Processed Logstash Template: ${logstashTemplate.output}`);

            return OCCommon.commonCommand("get", "service/logstash", [],
                [
                    new SimpleOption("-namespace", projectId),
                ])
                .then(() => {
                    logger.warn("Logstash Template has already been processed, service exists");
                    return SuccessPromise;
                }, () => {
                    return OCCommon.createFromData(JSON.parse(logstashTemplate.output),
                        [
                            new SimpleOption("-namespace", projectId),
                        ]);
                });
        });
}
