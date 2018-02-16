import {BitbucketConfig} from "./BitbucketConfig";

export interface SubAtomicConfig {
    commandPrefix: string;
    gluonBaseUrl: string;
    openshiftHost: string;
    bitbucket: BitbucketConfig;
}
