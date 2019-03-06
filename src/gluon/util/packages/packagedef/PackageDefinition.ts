export interface PackageDefinition {
    openshiftTemplate?: string;
    buildConfig: BuildConfig;
    deploymentConfig?: DeploymentConfig;
    jenkinsfile?: string;
    requiredEnvironmentVariables?: RequiredEnvironmentVariable[];
}

export interface BuildConfig {
    imageStream: ImageStreamDefinition;
    envVariables?: { [key: string]: string };
}

export interface DeploymentConfig {
    envVariables: { [key: string]: string };
}

export interface RequiredEnvironmentVariable {
    name: string;
    description: string;
    setter: string;
}

export interface ImageStreamDefinition {
    imageName: string;
    imageTag: string;
}
