export interface OpenshiftResource {
    kind: string;
    apiVersion: string;
    metadata: { [key: string]: any };
    [key: string]: any;
}

export interface OpenshiftListResource extends OpenshiftResource {
    items: OpenshiftResource[];
}
