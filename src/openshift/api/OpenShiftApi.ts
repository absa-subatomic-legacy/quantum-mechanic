import {AxiosResponse} from "axios";
import {OpenShiftApiElement} from "./base/OpenShiftApiElement";
import {OpenShiftConfigContract} from "./base/OpenShiftConfigContract";
import {OpenShiftApiCreate} from "./OpenShiftApiCreate";
import {OpenShiftApiDelete} from "./OpenShiftApiDelete";
import {OpenShiftApiPolicy} from "./OpenShiftApiPolicy";
import {OpenshiftResource} from "./resources/OpenshiftResource";
import {ResourceFactory} from "./resources/ResourceFactory";

export class OpenShiftApi extends OpenShiftApiElement {

    public create: OpenShiftApiCreate;
    public delete: OpenShiftApiDelete;
    public policy: OpenShiftApiPolicy;

    constructor(
        openshiftConfig: OpenShiftConfigContract,
    ) {
        super(openshiftConfig);
        this.create = new OpenShiftApiCreate(openshiftConfig);
        this.delete = new OpenShiftApiDelete(openshiftConfig);
        this.policy = new OpenShiftApiPolicy(openshiftConfig);
    }

    public newProject(projectName: string,
                      projectDisplayName: string,
                      projectDescription: string): Promise<AxiosResponse> {
        return this.newProjectFromResource(
            ResourceFactory.projectResource(projectName, projectDisplayName, projectDescription));
    }

    public newProjectFromResource(projectResource: OpenshiftResource): Promise<AxiosResponse> {
        const instance = this.getAxiosInstanceOApi();
        return instance.post("projectrequests", projectResource);
    }

    public deleteProject(projectName: string): Promise<AxiosResponse> {
        const instance = this.getAxiosInstanceOApi();
        return instance.delete(`projects/${projectName}`);
    }

}
