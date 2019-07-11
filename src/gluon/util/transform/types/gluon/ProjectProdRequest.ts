import {QMMemberBase} from "./Member";
import {
    QMDeploymentPipeline,
    QMProjectBase,
} from "./Project";

export interface QMProjectProdRequestBase {
    projectProdRequestId: string;
    approvalStatus: string;
}

export interface QMProjectProdRequest extends QMProjectProdRequestBase {
    project: QMProjectBase;
    actionedBy: QMMemberBase;
    authorizingMembers: QMMemberBase[];
    rejectingMember?: QMMemberBase;
    deploymentPipeline: QMDeploymentPipeline;
}
