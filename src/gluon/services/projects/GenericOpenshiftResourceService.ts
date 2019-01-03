import {OpenshiftResource} from "../../../openshift/api/resources/OpenshiftResource";

export class GenericOpenshiftResourceService {

    public cleanAllPromotableResources(resources) {

        this.cleanGeneric(resources);
        this.cleanServices(resources);
        this.cleanDeploymentConfigs(resources);
        this.cleanImageStreams(resources);
        this.cleanRoutes(resources);
        this.cleanPVCs(resources);

        return resources;
    }

    public migrateDeploymentConfigImageStreamNamespaces(allResources: OpenshiftResource[], oldNamespace: string, newNamespace: string) {
        for (const resource of allResources) {
            if (resource.kind === "DeploymentConfig") {
                this.migrateDeploymentConfigImageStreamNamespace(resource, oldNamespace, newNamespace);
            }
        }
        return allResources;
    }

    public migrateDeploymentConfigImageStreamNamespace(deploymentConfig: OpenshiftResource, oldNamespace: string, newNamespace: string) {
        for (const container of deploymentConfig.spec.template.spec.containers) {
            if (container.image.indexOf(oldNamespace) !== -1) {
                container.image = " ";
            }
        }
        for (const trigger of deploymentConfig.spec.triggers) {
            if (trigger.type === "ImageChange" && trigger.imageChangeParams.from.namespace === oldNamespace) {
                trigger.imageChangeParams.from.namespace = newNamespace;
            }
        }
        return deploymentConfig;
    }

    private cleanGeneric(allResources) {
        for (const resource of allResources) {
            delete resource.generation;
            delete resource.metadata.creationTimestamp;
            delete resource.metadata.namespace;
            delete resource.metadata.resourceVersion;
            delete resource.metadata.selfLink;
            delete resource.metadata.uid;
            delete resource.metadata.generation;
        }
    }

    private cleanServices(allResources) {
        for (const resource of allResources) {
            if (resource.kind === "Service") {
                delete resource.spec.clusterIP;
            }
        }
    }

    private cleanPVCs(allResources) {
        for (const resource of allResources) {
            if (resource.kind === "PersistentVolumeClaim") {
                delete resource.spec.volumeName;
                delete resource.metadata.annotations;
            }
        }
    }

    private cleanDeploymentConfigs(allResources) {
        for (const resource of allResources) {
            if (resource.kind === "DeploymentConfig") {
                resource.spec.replicas = 0;
                delete resource.status;
                delete resource.spec.template.spec.containers.terminationMessagePolicy;
                delete resource.spec.template.spec.schedulerName;
            }
        }
    }

    private cleanImageStreams(allResources) {
        for (const resource of allResources) {
            if (resource.kind === "ImageStream") {
                resource.spec.tags = [];
            }
        }
    }

    private cleanRoutes(allResources) {
        for (const resource of allResources) {
            if (resource.kind === "Route") {
                delete resource.spec.host;
                resource.status = {};
            }
        }
    }
}
