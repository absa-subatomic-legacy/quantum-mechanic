export class GenericOpenshiftResourceService {

    public async getAllPromotableResources(resources) {

        this.cleanAll(resources);
        this.cleanServices(resources);
        this.cleanDeploymentConfigs(resources);
        this.cleanImageStreams(resources);
        this.cleanRoutes(resources);
        this.cleanPVCs(resources);

        return resources;
    }

    private cleanAll(allResources) {
        for (const resource of allResources.items) {
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
        for (const resource of allResources.items) {
            if (resource.kind === "PersistentVolumeClaim") {
                delete resource.spec.clusterIP;
            }
        }
    }

    private cleanPVCs(allResources) {
        for (const resource of allResources.items) {
            if (resource.kind === "PersistentVolumeClaim") {
                delete resource.spec.volumeName;
                delete resource.metadata.annotations;
            }
        }
    }

    private cleanDeploymentConfigs(allResources) {
        for (const resource of allResources.items) {
            if (resource.kind === "DeploymentConfig") {
                delete resource.status;
                delete resource.spec.replicas;
                delete resource.spec.template.spec.containers.terminationMessagePolicy;
                delete resource.spec.template.spec.schedulerName;
            }
        }
    }

    private cleanImageStreams(allResources) {
        for (const resource of allResources.items) {
            if (resource.kind === "ImageStream") {
                resource.spec.tags = [];
            }
        }
    }

    private cleanRoutes(allResources) {
        for (const resource of allResources.items) {
            if (resource.kind === "Route") {
                delete resource.spec.host;
                resource.status = {};
            }
        }
    }
}
