export interface OpenShiftConfig {
    name: string;
    usernameCase: string;
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
    sharedResourceNamespace: string;
    openshiftNonProd: OpenShiftConfig;
    openshiftProd: OpenShiftConfig[];
}
