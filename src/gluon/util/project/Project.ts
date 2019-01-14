import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import * as _ from "lodash";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMBitbucketProject} from "../bitbucket/Bitbucket";
import {createMenuAttachment} from "../shared/GenericMenu";
import {QMTenant} from "../shared/Tenants";
import {QMTeam} from "../team/Teams";

/**
 * Returns the expected OpenShift namespace for a given project pipeline environment.
 * @param tenant - Owning tenant for the project
 * @param project - The name of the project
 * @param pipelineTag - The tag of the pipeline the namespace is for
 * @param environment - The environment postfix for the namespace
 */
export function getProjectOpenshiftNamespace(tenant: string, project: string, pipelineTag: string, environment: string): string {
    let postFix = `${_.kebabCase(pipelineTag)}-${environment.toLowerCase()}`;
    if (!_.isEmpty(pipelineTag)) {
        postFix = "-" + postFix;
    }

    return `${_.kebabCase(tenant).toLowerCase()}-${_.kebabCase(project).toLowerCase()}${postFix}`;
}

/**
 * Returns the DevOps OpenShift namespace for a given team
 * @param team - The name of the team
 */
export function getProjectDevOpsId(team: string): string {
    return `${_.kebabCase(team).toLowerCase()}-devops`;
}

/**
 * Return the displayable or readable name for a given project pipeline environment
 * @param tenant - Owning tenant for the project
 * @param project - The name of the project
 * @param pipelineTag - The tag of the pipeline the namespace is for
 * @param environment - The environment description for the namespace
 */
export function getProjectDisplayName(tenant: string, project: string, pipelineTag: string, environment: string): string {
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

/**
 * Create Slack Menu attachment listing all selectable projects
 * @param ctx - Atomist context
 * @param projects - Projects to add as selectable options
 * @param command - The Atomist Command Handler to reinvoke upon selection
 * @param message - The prompt that will be displayed to the user above the menu
 * @param projectNameVariable - The variable name in the *command* that the selected value will be injected into
 */
export function menuAttachmentForProjects(ctx: HandlerContext, projects: Array<{ name: string }>,
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

/**
 * Returns a list of all OpenShift environment namespace names for a given project.
 * This includes all devDipeline environments and releasePipeline environments.
 * @param tenantName - Project owning tenant
 * @param project - The project to build the namespace names for.
 */
export function getDeploymentEnvironmentNamespacesFromProject(tenantName: string, project: QMProject): string[] {
    const namespaces: string[] = getDeploymentEnvironmentNamespacesFromDeploymentPipeline(tenantName, project.name, project.devDeploymentPipeline);
    namespaces.push(...getDeploymentEnvironmentNamespacesFromDeploymentPipelines(tenantName, project.name, project.releaseDeploymentPipelines));
    return namespaces;
}

/**
 * Returns a list of all OpenShift environment namespace names for a given project and a specified list of pipelines.
 * @param tenantName - Project owning tenant
 * @param projectName - Name of the project the environments are part of.
 * @param deploymentPipelines - The deployment pipelines list to build the namespace names for.
 */
export function getDeploymentEnvironmentNamespacesFromDeploymentPipelines(tenantName: string, projectName: string, deploymentPipelines: QMDeploymentPipeline[]): string[] {
    const namespaces: string[] = [];
    for (const pipeline of deploymentPipelines) {
        namespaces.push(...getDeploymentEnvironmentNamespacesFromDeploymentPipeline(tenantName, projectName, pipeline));
    }
    return namespaces;
}

/**
 * Returns a list of all OpenShift environment namespace names for a given project and a specified pipeline.
 * @param tenantName - Project owning tenant
 * @param projectName - Name of the project the environments are part of.
 * @param deploymentPipeline - The deployment pipeline to build the namespace names for.
 */
export function getDeploymentEnvironmentNamespacesFromDeploymentPipeline(tenantName: string, projectName: string, deploymentPipeline: QMDeploymentPipeline): string[] {
    const namespaces: string[] = [];
    for (const environment of deploymentPipeline.environments) {
        namespaces.push(getProjectOpenshiftNamespace(tenantName, projectName, deploymentPipeline.tag, environment.postfix));
    }
    return namespaces;
}

/**
 * Return a list of project OpenShiftNamespaces using a particular deployment pipelines and the default environments specified for an OpenShiftCluster.
 * The list of OpenShiftNamespaces contains details about the namespace and its various name components.
 * @param tenantName - The project owning tenant
 * @param project - The project to generate the OpenShiftNamespace list for
 * @param deploymentPipeline - The deployment pipeline to build the OpenShiftNamespaces for.
 * @param openShiftCluster - The OpenShift cluster OpenShiftConfig to use the default environments for.
 */
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

/**
 * Return a list of project OpenShiftNamespaces for all the deployment pipelines associated to a project.
 * The list of OpenShiftNamespaces contains details about the namespace and its various name components.
 * @param tenantName - The project owning tenant name
 * @param project - The project to generate the OpenShiftNamespace list for
 */
export function getAllPipelineOpenshiftNamespacesForAllPipelines(tenantName: string, project: QMProject) {
    const namespaces: OpenShiftProjectNamespace[] = getAllPipelineOpenshiftNamespaces(tenantName, project.name, project.devDeploymentPipeline);
    for (const pipeline of project.releaseDeploymentPipelines) {
        namespaces.push(...getAllPipelineOpenshiftNamespaces(tenantName, project.name, pipeline));
    }
    return namespaces;
}

/**
 * Return a list of project OpenShiftNamespaces for a particular deployment pipeline.
 * The list of OpenShiftNamespaces contains details about the namespace and its various name components.
 * @param owningTenantName - The project owning tenant name
 * @param projectName - The name of the project to generate the OpenShiftNamespace list for
 * @param pipeline - The particular pipeline to generate the namespaces for
 */
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
