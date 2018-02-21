import {BitbucketConfig} from "./BitbucketConfig";
import {DocsConfig} from "./DocsConfig";
import {GluonConfig} from "./GluonConfig";
import {OpenshiftConfig} from "./OpenshiftConfig";

export interface SubatomicConfig {
    bitbucket: BitbucketConfig;
    commandPrefix: string;
    docs: DocsConfig;
    gluon: GluonConfig;
    openshift: OpenshiftConfig;
}
