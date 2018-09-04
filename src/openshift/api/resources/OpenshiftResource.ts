export interface OpenshiftResource {
    kind: string;
    apiVersion: string;
    metadata: object;
    [key: string]: any;
}
