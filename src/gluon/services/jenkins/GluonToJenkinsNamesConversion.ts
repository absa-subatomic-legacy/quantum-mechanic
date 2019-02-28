import * as _ from "lodash";

export function gluonApplicationNameToBuildViewName(gluonApplicationName: string) {
    return _.startCase(gluonApplicationName);
}

export function gluonApplicationNameToBuildJobName(gluonApplicationName: string) {
    return _.kebabCase(gluonApplicationName).toLowerCase();
}

export function gluonProjectNameToJobName(gluonProjectName: string) {
    return _.kebabCase(gluonProjectName).toLowerCase();
}
