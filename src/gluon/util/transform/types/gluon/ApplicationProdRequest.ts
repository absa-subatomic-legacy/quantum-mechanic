import {OpenshiftResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {QMDeploymentPipeline} from "./Project";

export interface QMApplicationProdRequest {
    applicationProdRequestId: string;
    applicationId: string;
    actionedBy: string;
    openShiftResources: OpenshiftResource[];
    deploymentPipeline: QMDeploymentPipeline;
}
