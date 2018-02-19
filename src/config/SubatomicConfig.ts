import {BitbucketConfig} from "./BitbucketConfig";

export interface SubatomicConfig {
    commandPrefix: string;
    gluonBaseUrl: string;
    openshiftHost: string;
    bitbucket: BitbucketConfig;
}
