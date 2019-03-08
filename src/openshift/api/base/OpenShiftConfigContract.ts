export interface OpenShiftConfigContract {
    name: string;
    masterUrl: string;
    auth: OpenShiftAuthContract;
    internalDockerRegistryUrl: string;
}

export interface OpenShiftAuthContract {
    token: string;
}
