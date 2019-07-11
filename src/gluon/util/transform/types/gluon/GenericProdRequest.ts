import {OpenshiftResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {QMMemberBase} from "./Member";
import {QMDeploymentPipeline, QMProjectBase} from "./Project";

export interface QMGenericProdRequest {
    genericProdRequestId: string;
    project: QMProjectBase;
    actionedBy: QMMemberBase;
    openShiftResources: OpenshiftResource[];
    deploymentPipeline: QMDeploymentPipeline;
}
