export interface OpenshiftConfig {
    masterUrl: string;
    auth: OpenshiftAuth;
}

export interface OpenshiftAuth {
    token: string;
}
