import {QMMemberBase} from "./Member";

export interface QMNewApplication {
    name: string;
    description: string;
    applicationType: string;
    projectId: string;
    bitbucketRepository: QMBitbucketRepository;
    createdBy: QMMemberBase;
    requestConfiguration: boolean;
}

export interface QMApplication {
    applicationId: string;
    name: string;
    description: string;
    applicationType: string;
    projectId: string;
    jenkinsFolder?: string;
    bitbucketRepository: QMBitbucketRepository;
    createdBy: QMMemberBase;
}

export interface QMBitbucketRepository {
    bitbucketId?: string;
    slug?: string;
    name: string;
    repoUrl: string;
    remoteUrl?: string;
}
