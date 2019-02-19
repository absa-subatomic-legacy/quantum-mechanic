import {HandlerContext} from "@atomist/automation-client";
import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import * as _ from "lodash";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMBitbucketProject} from "../bitbucket/Bitbucket";
import {createMenuAttachment} from "../shared/GenericMenu";
import {QMTenant} from "../shared/Tenants";
import {QMTeam, QMTeamBase} from "../team/Teams";

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
 * @param pipelineDisplayName - The name of the pipeline the namespace is for
 * @param environment - The environment description for the namespace
 */
export function getProjectDisplayName(tenant: string, project: string, pipelineDisplayName: string, environment: string): string {
    let displayName = environment;

    if (!_.isEmpty(pipelineDisplayName) && pipelineDisplayName.toLowerCase() !== "default") {
        displayName = pipelineDisplayName + " " + displayName;
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
        const postfix = getDeploymentEnvironmentFullPostfix(deploymentPipeline.tag, environment.id);

        environmentsForCreation.push(
            {
                namespace: getProjectOpenshiftNamespace(tenantName, project.name, deploymentPipeline.tag, environment.id),
                displayName: getProjectDisplayName(tenantName, project.name, deploymentPipeline.name, environment.description),
                postfix,
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
        const postfix = getDeploymentEnvironmentFullPostfix(pipeline.tag, environment.postfix);

        environmentsForCreation.push(
            {
                namespace: getProjectOpenshiftNamespace(owningTenantName, projectName, pipeline.tag, environment.postfix),
                displayName: getProjectDisplayName(owningTenantName, projectName, pipeline.name, environment.displayName),
                postfix,
            },
        );
    }

    return environmentsForCreation;
}

export function getDeploymentEnvironmentJenkinsMetadata(tenantName: string, projectName: string, pipeline: QMDeploymentPipeline, environment: QMDeploymentEnvironment): JenkinsProjectMetadata {
    return {
        displayName: getProjectDisplayName(tenantName, projectName, pipeline.name, environment.displayName),
        postfix: getDeploymentEnvironmentFullPostfix(pipeline.tag, environment.postfix),
    };
}

function getDeploymentEnvironmentFullPostfix(owningPipelineTag: string, deploymentEnvironmentPostfix: string) {
    let postfix = `${_.kebabCase(owningPipelineTag)}-${deploymentEnvironmentPostfix}`;
    if (_.isEmpty(owningPipelineTag)) {
        postfix = deploymentEnvironmentPostfix;
    }
    return postfix;
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

export interface JenkinsProjectMetadata {
    displayName: string;
    postfix: string;
}

export interface QMProjectBase {
    projectId: string;
    name: string;
    bitbucketProject: QMBitbucketProject;
    owningTenant: string;
    description: string;
}

export interface QMProject extends QMProjectBase {
    owningTeam: QMTeamBase;
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
