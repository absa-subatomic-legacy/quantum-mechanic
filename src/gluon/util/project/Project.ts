import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import * as _ from "lodash";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMBitbucketProject} from "../bitbucket/Bitbucket";
import {createMenuAttachment} from "../shared/GenericMenu";
import {QMTenant} from "../shared/Tenants";
import {QMTeam} from "../team/Teams";

export function getProjectId(tenant: string, project: string, environment: string): string {
    return `${_.kebabCase(tenant).toLowerCase()}-${_.kebabCase(project).toLowerCase()}-${environment.toLowerCase()}`;
}

export function getProjectDevOpsId(team: string): string {
    return `${_.kebabCase(team).toLowerCase()}-devops`;
}

export function getProjectDisplayName(tenant: string, project: string, environment: string) {
    if (tenant.toLowerCase() === "default") {
        return `${project} ${environment}`;
    }

    return `${tenant} ${project} ${environment}`;
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
        namespaces.push(getProjectId(tenantName, projectName, environment.postfix));
    }
    return namespaces;
}

export function getPipelineOpenShiftNamespacesForOpenShiftCluster(tenantName: string, project: QMProject, deploymentPipeline: QMDeploymentPipeline, openShiftCluster: OpenShiftConfig): OpenShiftProjectNamespace[] {
    // TODO: need deploymentPipeline to use the tag
    const environmentsForCreation: OpenShiftProjectNamespace[] = [];

    for (const environment of openShiftCluster.defaultEnvironments) {
        environmentsForCreation.push(
            {
                namespace: getProjectId(tenantName, project.name, environment.id),
                displayName: getProjectDisplayName(tenantName, project.name, environment.description),
                postfix: environment.id,
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
