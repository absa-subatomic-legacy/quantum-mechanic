import {BitbucketConfig} from "./BitbucketConfig";
import {DocsConfig} from "./DocsConfig";
import {GluonConfig} from "./GluonConfig";
import {MavenConfig} from "./MavenConfig";
import {NexusConfig} from "./NexusConfig";
import {OpenShiftCloud, OpenShiftConfig} from "./OpenShiftConfig";
import {PluginConfig} from "./PluginConfig";

export interface SubatomicConfig {
    bitbucket: BitbucketConfig;
    commandPrefix: string;
    docs: DocsConfig;
    gluon: GluonConfig;
    openshiftClouds: { [k: string]: OpenShiftCloud };
    openshiftProd: OpenShiftConfig[];
    nexus: NexusConfig;
    maven: MavenConfig;
    plugins: PluginConfig;
}
