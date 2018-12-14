export interface PackageDefinition {
    openshiftTemplate?: string;
    buildConfig: BuildConfig;
    jenkinsfile?: string;
    requiredEnvironmentVariables?: RequiredEnvironmentVariable[];
}

export interface BuildConfig {
    imageStream: string;
    envVariables?: { [key: string]: string };
}

export interface RequiredEnvironmentVariable {
    name: string;
    description: string;
    setter: string;
}
