import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import * as _ from "lodash";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMBitbucketProject} from "../bitbucket/Bitbucket";
import {createMenuAttachment} from "../shared/GenericMenu";
import {QMTenant} from "../shared/Tenants";
import {QMTeam} from "../team/Teams";

export function getProjectOpenshiftNamespace(tenant: string, project: string, pipelineTag: string, environment: string): string {

    let postFix = `${_.kebabCase(pipelineTag)}-${environment.toLowerCase()}`;
    if (!_.isEmpty(pipelineTag)) {
        postFix = "-" + postFix;
    }

    return `${_.kebabCase(tenant).toLowerCase()}-${_.kebabCase(project).toLowerCase()}${postFix}`;
}

export function getProjectDevOpsId(team: string): string {
    return `${_.kebabCase(team).toLowerCase()}-devops`;
}

export function getProjectDisplayName(tenant: string, project: string, pipelineTag: string, environment: string) {
    let displayName = environment;

    if (!_.isEmpty(pipelineTag)) {
        displayName = pipelineTag + " " + displayName;
    }

    displayName = project + " " + displayName;

    if (tenant.toLowerCase() !== "default") {
        displayName = tenant + " " + displayName;
    }

    return displayName;
}

export function menuAttachmentForProjects(ctx: HandlerContext, projects: any[],
                                          command: HandleCommand, message: string = "Please select a project",
                                          projectNameVariable: string = "projectName") {
    return createMenuAttachment(
        projects.map(project => {
            return {
                value: project.name,
                text: project.name,
            };
        }),
        command,
        message,
        message,
        "Select Project",
        projectNameVariable,
    );
}

export function getDeploymentEnvironmentNamespacesFromProject(tenantName: string, project: QMProject) {
    const namespaces: string[] = getDeploymentEnvironmentNamespacesFromDeploymentPipeline(tenantName, project.name, project.devDeploymentPipeline);
    namespaces.push(...getDeploymentEnvironmentNamespacesFromDeploymentPipelines(tenantName, project.name, project.releaseDeploymentPipelines));
    return namespaces;
}

export function getDeploymentEnvironmentNamespacesFromDeploymentPipelines(tenantName: string, projectName: string, deploymentPipelines: QMDeploymentPipeline[]) {
    const namespaces: string[] = [];
    for (const pipeline of deploymentPipelines) {
        namespaces.push(...getDeploymentEnvironmentNamespacesFromDeploymentPipeline(tenantName, projectName, pipeline));
    }
    return namespaces;
}

export function getDeploymentEnvironmentNamespacesFromDeploymentPipeline(tenantName: string, projectName: string, deploymentPipeline: QMDeploymentPipeline) {
    const namespaces: string[] = [];
    for (const environment of deploymentPipeline.environments) {
        namespaces.push(getProjectOpenshiftNamespace(tenantName, projectName, deploymentPipeline.tag, environment.postfix));
    }
    return namespaces;
}

export function getPipelineOpenShiftNamespacesForOpenShiftCluster(tenantName: string, project: QMProject, deploymentPipeline: QMDeploymentPipeline, openShiftCluster: OpenShiftConfig): OpenShiftProjectNamespace[] {
    const environmentsForCreation: OpenShiftProjectNamespace[] = [];

    for (const environment of openShiftCluster.defaultEnvironments) {
        let postFix = `${_.kebabCase(deploymentPipeline.tag)}-${environment.id}`;
        if (_.isEmpty(deploymentPipeline.tag)) {
            postFix = environment.id;
        }
        environmentsForCreation.push(
            {
                namespace: getProjectOpenshiftNamespace(tenantName, project.name, deploymentPipeline.tag, environment.id),
                displayName: getProjectDisplayName(tenantName, project.name, deploymentPipeline.tag, environment.description),
                postfix: postFix,
            },
        );
    }
    return environmentsForCreation;
}

export function getAllProjectOpenshiftNamespaces(owningTenant: QMTenant, project: QMProject): OpenShiftProjectNamespace[] {
    const pipelines: QMDeploymentPipeline[] = [project.devDeploymentPipeline];
    pipelines.push(...project.releaseDeploymentPipelines);

    const environmentsForCreation: OpenShiftProjectNamespace[] = [];
    for (const pipeline of pipelines) {
        environmentsForCreation.push(
            ...getAllPipelineOpenshiftNamespaces(owningTenant.name, project.name, pipeline),
        );
    }

    return environmentsForCreation;
}

export function getAllPipelineOpenshiftNamespacesForAllPipelines(tenantName: string, project: QMProject) {
    const namespaces: OpenShiftProjectNamespace[] = getAllPipelineOpenshiftNamespaces(tenantName, project.name, project.devDeploymentPipeline);
    for (const pipeline of project.releaseDeploymentPipelines) {
        namespaces.push(...getAllPipelineOpenshiftNamespaces(tenantName, project.name, pipeline));
    }
    return namespaces;
}

export function getAllPipelineOpenshiftNamespaces(owningTenantName: string, projectName: string, pipeline: QMDeploymentPipeline): OpenShiftProjectNamespace[] {
    const environmentsForCreation: OpenShiftProjectNamespace[] = [];
    for (const environment of pipeline.environments) {
        let postFix = `${_.kebabCase(pipeline.tag)}-${environment.postfix}`;
        if (_.isEmpty(pipeline.tag)) {
            postFix = environment.postfix;
        }
        environmentsForCreation.push(
            {
                namespace: getProjectOpenshiftNamespace(owningTenantName, projectName, pipeline.tag, environment.postfix),
                displayName: getProjectDisplayName(owningTenantName, projectName, pipeline.tag, environment.displayName),
                postfix: environment.postfix,
            },
        );
    }

    return environmentsForCreation;
}

export interface OpenshiftProjectEnvironmentRequest {
    teams: QMTeam[];
    project: QMProject;
    owningTenant: QMTenant;
}

export interface OpenShiftProjectNamespace {
    namespace: string;
    displayName: string;
    postfix: string;
}

export interface QMProjectBase {
    projectId: string;
    name: string;
    bitbucketProject: QMBitbucketProject;
    owningTenant: string;
}

export interface QMProject extends QMProjectBase {
    owningTeam: QMTeam;
    devDeploymentPipeline: QMDeploymentPipeline;
    releaseDeploymentPipelines: QMDeploymentPipeline[];
}

export interface QMDeploymentPipeline {
    pipelineId?: string;
    name: string;
    tag: string;
    environments: QMDeploymentEnvironment[];
}

export interface QMDeploymentEnvironment {
    positionInPipeline: number;
    displayName: string;
    postfix: string;
}

export enum ProjectProdRequestApprovalResponse {
    approve = "approve",
    reject = "reject",
    ignore = "ignore",
}
