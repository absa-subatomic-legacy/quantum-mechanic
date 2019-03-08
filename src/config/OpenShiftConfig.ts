export interface OpenShiftConfig {
    name: string;
    internalDockerRegistryUrl: string;
    externalDockerRegistryUrl: string;
    masterUrl: string;
    auth: OpenShiftAuth;
    defaultEnvironments: OpenshiftProjectEnvironment[];
}

export interface OpenShiftAuth {
    token: string;
}

export interface OpenshiftProjectEnvironment {
    id: string;
    description: string;
}

export interface OpenShiftCloud {
    openshiftNonProd: OpenShiftConfig;
    openshiftProd: OpenShiftConfig[];
}
