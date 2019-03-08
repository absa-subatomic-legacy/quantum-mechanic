import {logger} from "@atomist/automation-client";
import _ = require("lodash");
import * as XmlBuilder from "xmlbuilder";
import {QMConfig} from "../../../config/QMConfig";
import {OpenShiftProjectNamespace} from "../project/Project";
import {getDevOpsEnvironmentDetails} from "../team/Teams";

export function getJenkinsBitbucketAccessCredential(teamDevOpsProjectId: string) {
    return {
        "": "0",
        "credentials": {
            scope: "GLOBAL",
            id: `${teamDevOpsProjectId}-bitbucket`,
            username: QMConfig.subatomic.bitbucket.auth.username,
            password: QMConfig.subatomic.bitbucket.auth.password,
            description: `${teamDevOpsProjectId}-bitbucket`,
            $class: "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl",
        },
    };
}

export function getJenkinsBitbucketAccessCredentialXML(teamDevOpsProjectId) {
    const value = XmlBuilder.begin()
        .ele("com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl", {plugin: "credentials@2.1.18"})
        .ele("scope", "GLOBAL").up()
        .ele("id", `${teamDevOpsProjectId}-bitbucket`).up()
        .ele("description", `${teamDevOpsProjectId}-bitbucket`).up()
        .ele("username", `${QMConfig.subatomic.bitbucket.auth.username}`).up()
        .ele("password", `${QMConfig.subatomic.bitbucket.auth.password}`).up()
        .end({pretty: true});

    logger.debug("Built XML Credential: \n" + value);
    return value;
}

export function getJenkinsBitbucketProjectCredential(projectId: string): JenkinsCredentials {
    return {
        credentials: {
            scope: "GLOBAL",
            id: `${projectId}-bitbucket`,
            username: QMConfig.subatomic.bitbucket.auth.username,
            password: QMConfig.subatomic.bitbucket.auth.password,
            description: `${projectId}-bitbucket`,
            $class: "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl",
        },
    };
}

export function getJenkinsNexusCredential(): JenkinsCredentials {
    return {
        credentials: {
            scope: "GLOBAL",
            id: "nexus-base-url",
            secret: `${QMConfig.subatomic.nexus.baseUrl}/content/repositories/`,
            description: "Nexus base URL",
            $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
        },
    };
}

export function getJenkinsDockerCredential(openShiftCloud: string): JenkinsCredentials {
    return {
        credentials: {
            scope: "GLOBAL",
            id: "docker-registry-ip",
            secret: `${QMConfig.subatomic.openshiftClouds[openShiftCloud].openshiftNonProd.dockerRepoUrl}`,
            description: "IP For internal docker registry",
            $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
        },
    };
}

export function getJenkinsSubatomicSharedResourceNamespaceCredentials(openShiftCloud: string): JenkinsCredentials {
    return {
        credentials: {
            scope: "GLOBAL",
            id: "sub-shared-resource-namespace",
            secret: `${QMConfig.subatomic.openshiftClouds[openShiftCloud].sharedResourceNamespace}`,
            description: "Openshift namespace where shared Subatomic resources are stored",
            $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
        },
    };
}

export function getJenkinsMavenCredential(): JenkinsCredentials {
    return {
        credentials: {
            scope: "GLOBAL",
            id: "maven-settings",
            file: "file",
            fileName: "settings.xml",
            description: "Maven settings.xml",
            $class: "org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl",
        },
    };
}

export function getOpenshiftEnvironmentCredential(environment: OpenShiftProjectNamespace): JenkinsCredentials {
    return {
        credentials: {
            id: `${_.kebabCase(environment.postfix)}-project`,
            secret: environment.namespace,
            description: `${environment.displayName} OpenShift project Id`,
            $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
        },
    };
}

export function getOpenshiftProductionDevOpsJenkinsTokenCredential(teamName: string, prodEnvironmentName: string, productionToken: string) {
    const nonProdDevOpsEnvironmentDetails = getDevOpsEnvironmentDetails(teamName);
    return {
        credentials: {
            scope: "GLOBAL",
            id: `${nonProdDevOpsEnvironmentDetails.openshiftProjectId}-${_.kebabCase(prodEnvironmentName)}`,
            secret: productionToken,
            description: `${nonProdDevOpsEnvironmentDetails.openshiftProjectId} ${prodEnvironmentName} token`,
            $class: "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl",
        },
    };
}

export interface JenkinsCredentials {
    credentials: { id: string, [key: string]: any };
}
