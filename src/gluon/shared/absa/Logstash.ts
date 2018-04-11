import {logger, SuccessPromise} from "@atomist/automation-client";
import {AbsaConfig} from "../../../config/AbsaConfig";
import {SimpleOption} from "../../../openshift/base/options/SimpleOption";
import {OCCommon} from "../../../openshift/OCCommon";

export function createLogstashEndpoint(projectId: string): Promise<any> {
    logger.info("Processing Logstash commands...");
    return OCCommon.commonCommand("get", "service/logstash", [],
        [
            new SimpleOption("-namespace", projectId),
        ])
        .then(() => {
            logger.warn("Logstash has already been processed, service exists");
            return SuccessPromise;
        }, () => {
            return OCCommon.createFromData(getLogstashDefinition(),
                [
                    new SimpleOption("-namespace", projectId),
                ]);
        });
}

function getLogstashDefinition() {
    return {
        kind: "List",
        apiVersion: "v1",
        metadata: {},
        items: [
            {
                kind: "Service",
                apiVersion: "v1",
                metadata: {
                    labels: {
                        source: "subatomic-logstash",
                    },
                    name: "logstash",
                },
                spec: {
                    ports: [
                        {
                            port: "5145",
                        },
                    ],
                },
            },
            {
                kind: "Endpoints",
                apiVersion: "v1",
                metadata: {
                    labels: {
                        source: "subatomic-logstash",
                    },
                    name: "logstash",
                },
                subsets: [
                    {
                        addresses: [
                            {
                                ip: AbsaConfig.logstash.endpointHost1,
                            },
                            {
                                ip: AbsaConfig.logstash.endpointHost2,
                            },
                            {
                                ip: AbsaConfig.logstash.endpointHost3,
                            },
                            {
                                ip: AbsaConfig.logstash.endpointHost4,
                            },
                            {
                                ip: AbsaConfig.logstash.endpointHost5,
                            },
                        ],
                        ports: [
                            {
                                port: "5145",
                            },
                        ],
                    },
                ],
            },
        ],
    };
}
