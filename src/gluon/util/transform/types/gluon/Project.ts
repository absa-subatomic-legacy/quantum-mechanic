import {QMBitbucketProject} from "./Bitbucket";
import {QMTeamBase} from "./Team";

export interface QMProjectBase {
    projectId: string;
    name: string;
    bitbucketProject: QMBitbucketProject;
    owningTenant: string;
    description: string;
}

export interface QMProject extends QMProjectBase {
    owningTeam: QMTeamBase;
    devDeploymentPipeline: QMDeploymentPipeline;
    releaseDeploymentPipelines: QMDeploymentPipeline[];
    additionalEnvironments: QMAdditionalEnvironment[];
}

export interface QMDeploymentPipeline {
    pipelineId?: string;
    name: string;
    tag: string;
    environments: QMDeploymentEnvironment[];
}

export interface QMDeploymentEnvironment {
    positionInPipeline: number;
    displayName: string;
    postfix: string;
}

export interface QMAdditionalEnvironment {
    displayName: string;
}
