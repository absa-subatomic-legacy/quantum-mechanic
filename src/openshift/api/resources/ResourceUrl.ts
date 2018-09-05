import {OpenshiftApiBaseRoute} from "../base/OpenshiftApiBaseRoute";
import {OpenshiftResource} from "./OpenshiftResource";

export class ResourceUrl {

    public static getResourceKindUrl(resource: OpenshiftResource, namespace: string = "default"): string {
        const resourceKind = resource.kind.toLowerCase();
        let url: string;
        if (ResourceUrl.urlMap.hasOwnProperty(resourceKind)) {
            const urlDetails = ResourceUrl.urlMap[resourceKind];
            url = urlDetails[0].url;
            for (const urlDetail of urlDetails) {
                if (urlDetail.apiVersion === resource.apiVersion) {
                    url = urlDetail.url;
                    break;
                }
            }
            url = url
                .replace("${namespace}", namespace);
        } else {
            url = `namespaces/${namespace}/${resourceKind}s`;
        }
        return url;
    }

    public static getNamedResourceUrl(resource: OpenshiftResource, namespace: string = "default") {
        return ResourceUrl.getResourceKindUrl(resource, namespace) + `/${resource.metadata.name}`;
    }

    public static getResourceApi(resource: OpenshiftResource): OpenshiftApiBaseRoute {
        const resourceKind = resource.kind.toLowerCase();
        let api: OpenshiftApiBaseRoute;
        if (ResourceUrl.urlMap.hasOwnProperty(resourceKind)) {
            const urlDetails = ResourceUrl.urlMap[resourceKind];
            api = urlDetails[0].api;
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

    public static getNetworkResourceUrl(resourceKind: string, name = ""): string {
        let url = `${resourceKind}s`;
        if (name.length > 0) {
            url += `/${name}`;
        }
        return url;
    }

    private static urlMap: UrlMap = {
        user: [{
            apiVersion: "v1",
            url: "users",
            api: OpenshiftApiBaseRoute.OAPI,
        }],
        rolebinding: [{
            apiVersion: "v1",
            url: "namespaces/${namespace}/rolebindings",
            api: OpenshiftApiBaseRoute.OAPI,
        }, {
            apiVersion: "rbac.authorization.k8s.io/v1beta1",
            url: "namespaces/${namespace}/rolebindings",
            api: OpenshiftApiBaseRoute.API,
        },
        ],
    };
}

interface UrlMap {
    [key: string]: UrlDetail[];
}

interface UrlDetail {
    apiVersion: string;
    url: string;
    api: OpenshiftApiBaseRoute;
}
