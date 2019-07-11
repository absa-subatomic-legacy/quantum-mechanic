import {
    QMDeploymentPipeline,
} from "../transform/types/gluon/Project";
import {QMDeploymentEnvironment} from "../transform/types/gluon/Project";

export function getHighestPreProdEnvironment(deploymentPipeline: QMDeploymentPipeline): QMDeploymentEnvironment {
    return deploymentPipeline.environments[deploymentPipeline.environments.length - 1];
}

export function getResourceDisplayMessage(allResources) {
    let text = "Found the following resources:\n";

    for (const resource of allResources.items) {
        text += `\t*${resource.kind}:* ${resource.metadata.name}\n`;
    }
    return text;
}
