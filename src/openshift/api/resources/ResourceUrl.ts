import {OpenshiftApiBaseRoute} from "../base/OpenshiftApiBaseRoute";

export class ResourceUrl {

    public static getResourceUrl(resourceKind: string, namespace: string = "default"): string {
        resourceKind = resourceKind.toLowerCase();
        let url: string;
        if (ResourceUrl.urlMap.hasOwnProperty(resourceKind)) {
            url = ResourceUrl.urlMap[resourceKind].url
                .replace("${namespace}", namespace);
        } else {
            url = `namespaces/${namespace}/${resourceKind}s`;
        }
        return url;
    }

    public static getResourceApi(resourceKind: string): OpenshiftApiBaseRoute {
        resourceKind = resourceKind.toLowerCase();
        let api: OpenshiftApiBaseRoute;
        if (ResourceUrl.urlMap.hasOwnProperty(resourceKind)) {
            api = ResourceUrl.urlMap[resourceKind].api;
        } else {
            api = OpenshiftApiBaseRoute.API;
        }
        return api;
    }

    private static urlMap: UrlMap = {
        user: {
            url: "users",
            api: OpenshiftApiBaseRoute.OAPI,
        },
        rolebinding: {
            url: "namespaces/${namespace}/rolebindings",
            api: OpenshiftApiBaseRoute.OAPI,
        },
    };
}

interface UrlMap {
    [key: string]: UrlDetail;
}

interface UrlDetail {
    url: string;
    api: OpenshiftApiBaseRoute;
}
