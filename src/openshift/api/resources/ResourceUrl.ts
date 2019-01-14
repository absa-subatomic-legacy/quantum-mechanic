import {configuration} from "@atomist/lifecycle-automation";
import _ = require("lodash");
import {OpenshiftApiBaseRoute} from "../base/OpenshiftApiBaseRoute";
import {OpenshiftResource} from "./OpenshiftResource";

export class ResourceUrl {

    public static getResourceKindUrl(resource: OpenshiftResource, namespace: string = ""): string {
        const resourceKind = resource.kind.toLowerCase();
        let url: string;
        if (ResourceUrl.urlMap.hasOwnProperty(resourceKind)) {
            const urlDetails = ResourceUrl.urlMap[resourceKind];
            url = `${resourceKind}s`;
            for (const urlDetail of urlDetails) {
                if (urlDetail.apiVersion === resource.apiVersion) {
                    url = urlDetail.url;
                    break;
                }
            }
            url = processNamespacingForUrl(url, namespace);
        } else {
            url = processNamespacingForUrl(`${resourceKind}s`, namespace);
        }
        return url;
    }

    public static getNamedResourceUrl(resource: OpenshiftResource, namespace: string = "") {
        return ResourceUrl.getResourceKindUrl(resource, namespace) + `/${resource.metadata.name}`;
    }

    public static getResourceApi(resource: OpenshiftResource): OpenshiftApiBaseRoute {
        const resourceKind = resource.kind.toLowerCase();
        let api: OpenshiftApiBaseRoute;
        if (ResourceUrl.urlMap.hasOwnProperty(resourceKind)) {
            const urlDetails = ResourceUrl.urlMap[resourceKind];
            api = OpenshiftApiBaseRoute.API;
            for (const urlDetail of urlDetails) {
                if (urlDetail.apiVersion === resource.apiVersion) {
                    api = urlDetail.api;
                    break;
                }
            }
        } else {
            api = OpenshiftApiBaseRoute.API;
        }
        return api;
    }

    private static urlMap: UrlMap = {
        user: [
            {
                apiVersion: configuration.apiVersion,
                url: "users",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        imagestream: [
            {
                apiVersion: configuration.apiVersion,
                url: "imagestreams",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        imagestreamtag: [
            {
                apiVersion: configuration.apiVersion,
                url: "imagestreamtags",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        buildconfig: [
            {
                apiVersion: configuration.apiVersion,
                url: "buildconfigs",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        deploymentconfig: [
            {
                apiVersion: configuration.apiVersion,
                url: "deploymentconfigs",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        route: [
            {
                apiVersion: configuration.apiVersion,
                url: "routes",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        endpoints: [
            {
                apiVersion: configuration.apiVersion,
                url: "endpoints",
                api: OpenshiftApiBaseRoute.API,
            },
        ],
        template: [
            {
                apiVersion: configuration.apiVersion,
                url: "templates",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        rolebinding: [
            {
                apiVersion: configuration.apiVersion,
                url: "rolebindings",
                api: OpenshiftApiBaseRoute.OAPI,
            }, {
                apiVersion: "rbac.authorization.k8s.io/v1beta1",
                url: "rolebindings",
                api: OpenshiftApiBaseRoute.API,
            },
        ],
        clusternetwork: [
            {
                apiVersion: configuration.apiVersion,
                url: "clusternetworks",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        netnamespace: [
            {
                apiVersion: configuration.apiVersion,
                url: "netnamespaces",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        project: [
            {
                apiVersion: configuration.apiVersion,
                url: "projects",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        processedtemplate: [
            {
                apiVersion: configuration.apiVersion,
                url: "processedtemplates",
                api: OpenshiftApiBaseRoute.OAPI,
            },
        ],
        persistentvolumeclaim: [
            {
                apiVersion: configuration.apiVersion,
                url: "persistentvolumeclaims",
                api: OpenshiftApiBaseRoute.API,
            },
        ],
        service: [
            {
                apiVersion: configuration.apiVersion,
                url: "services",
                api: OpenshiftApiBaseRoute.API,
            },
        ],
        secret: [
            {
                apiVersion: configuration.apiVersion,
                url: "secrets",
                api: OpenshiftApiBaseRoute.API,
            },
        ],
    };
}

function processNamespacingForUrl(urlCore: string, namespace: string): string {
    let url: string = urlCore;
    if (!_.isEmpty(namespace)) {
        url = `namespaces/${namespace}/${urlCore}`;
    }
    return url;
}

interface UrlMap {
    [key: string]: UrlDetail[];
}

interface UrlDetail {
    apiVersion: string;
    url: string;
    api: OpenshiftApiBaseRoute;
}
