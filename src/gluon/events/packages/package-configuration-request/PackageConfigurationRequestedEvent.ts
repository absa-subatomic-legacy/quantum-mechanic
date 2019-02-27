import {GluonApplicationEvent} from "../../../util/transform/types/event/GluonApplicationEvent";
import {KeyValuePairEvent} from "../../../util/transform/types/event/KeyValuePairEvent";
import {MemberEvent} from "../../../util/transform/types/event/MemberEvent";
import {ProjectEvent} from "../../../util/transform/types/event/ProjectEvent";

export interface PackageConfigurationRequestedEvent {
    application: GluonApplicationEvent;
    project: ProjectEvent;
    imageName: string;
    openshiftTemplate: string;
    jenkinsfileName: string;
    buildEnvironmentVariables: KeyValuePairEvent[];
    deploymentEnvironmentVariables: KeyValuePairEvent[];
    actionedBy: MemberEvent;
}
