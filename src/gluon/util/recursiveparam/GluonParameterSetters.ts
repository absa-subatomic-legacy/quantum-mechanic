import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {menuAttachmentForApplications} from "../packages/Applications";
import {menuAttachmentForProjects} from "../project/Project";
import {QMError} from "../shared/Error";
import {
    createMenuAttachment,
    createSortedMenuAttachment,
} from "../shared/GenericMenu";
import {menuAttachmentForTenants} from "../shared/Tenants";
import {menuAttachmentForTeams} from "../team/Teams";
import {QMProject} from "../transform/types/gluon/Project";
import {QMTeam} from "../transform/types/gluon/Team";
import {
    RecursiveParameter,
    RecursiveParameterDetails,
} from "./RecursiveParameterRequestCommand";
import {RecursiveSetterResult} from "./RecursiveSetterResult";

export async function setGluonTeamName(
    ctx: HandlerContext,
    commandHandler: GluonTeamNameSetter,
    selectionMessage: string = "Please select a team"): Promise<RecursiveSetterResult> {
    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonTeamName commandHandler requires gluonService parameter to be defined`);
    }

    if (commandHandler.slackUserId === undefined) {
        throw new QMError(`setGluonTeamName commandHandler requires slackUserId mapped parameter to be defined`);
    }

    let teams: QMTeam[];
    if (commandHandler.teamChannel !== undefined) {
        try {
            teams = await commandHandler.gluonService.teams.getTeamsBySlackTeamChannel(commandHandler.teamChannel);
            if (teams.length === 1) {
                commandHandler.teamName = teams[0].name;
                return {setterSuccess: true};
            }
        } catch (slackChannelError) {
            logger.info(`Could not find team associated with channel: ${commandHandler.teamChannel}. Trying to find teams member is a part of.`);
        }
    }

    if (teams === undefined) {
        logger.info(`CommandHandler teamChannel is undefined. Trying to find teams member is a part of.`);
        teams = await commandHandler.gluonService.teams.getTeamsWhoSlackUserIdBelongsTo(commandHandler.slackUserId);
    }
    return {
        setterSuccess: false,
        messagePrompt: menuAttachmentForTeams(
            ctx,
            teams,
            commandHandler,
            selectionMessage),
    };
}

export function GluonTeamNameParam(details: RecursiveParameterDetails) {
    details.setter = setGluonTeamName;
    return RecursiveParameter(details);
}

export interface GluonTeamNameSetter {
    gluonService: GluonService;
    teamChannel?: string;
    slackUserId: string;
    teamName: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export async function setGluonTeamOpenShiftCloudInferred(
    ctx: HandlerContext,
    commandHandler: GluonTeamOpenShiftCloudSetter,
    selectionMessage: string = "Please select an OpenShift cloud"): Promise<RecursiveSetterResult> {
    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonTeamName commandHandler requires gluonService parameter to be defined`);
    }

    let team;

    if (commandHandler.teamName !== undefined) {
        try {
            team = await commandHandler.gluonService.teams.getTeamByName(commandHandler.teamName);
        } catch (error) {
            team = undefined;
        }
    }

    if (team !== undefined) {
        commandHandler.openShiftCloud = team.openShiftCloud;
        return {setterSuccess: true};
    } else {
        return await setGluonTeamOpenShiftCloud(ctx, commandHandler, selectionMessage);
    }
}

export async function setGluonTeamOpenShiftCloud(
    ctx: HandlerContext,
    commandHandler: GluonTeamOpenShiftCloudBaseSetter,
    selectionMessage: string = "Please select an OpenShift cloud"): Promise<RecursiveSetterResult> {
    return {
        setterSuccess: false,
        messagePrompt: createMenuAttachment(
            Object.keys(QMConfig.subatomic.openshiftClouds).filter(cloudName => {
                return QMConfig.subatomic.openshiftClouds[cloudName].canProvisionNewTeams;
            }).map(cloudName => {
                return {
                    value: cloudName,
                    text: cloudName,
                };
            }),
            commandHandler,
            {
                text: selectionMessage,
                fallback: selectionMessage,
                selectionMessage: "Select OpenShift Cloud",
                resultVariableName: "openShiftCloud",
            },
        ),
    };
}

export function GluonTeamOpenShiftCloudParam(details: RecursiveParameterDetails) {
    details.setter = setGluonTeamOpenShiftCloudInferred;
    return RecursiveParameter(details);
}

export interface GluonTeamOpenShiftCloudBaseSetter {
    openShiftCloud: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export interface GluonTeamOpenShiftCloudSetter extends GluonTeamOpenShiftCloudBaseSetter {
    gluonService: GluonService;
    teamName: string;
}

export async function setGluonProjectName(
    ctx: HandlerContext,
    commandHandler: GluonProjectNameSetter,
    selectionMessage: string = "Please select a project"): Promise<RecursiveSetterResult> {

    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonProjectName commandHandler requires gluonService parameter to be defined`);
    }

    if (commandHandler.teamName === undefined) {
        throw new QMError(`setGluonProjectName commandHandler requires the teamName parameter to be defined`);
    }

    const projects = await commandHandler.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(commandHandler.teamName);
    return {
        setterSuccess: false,
        messagePrompt: menuAttachmentForProjects(
            ctx,
            projects,
            commandHandler,
            selectionMessage,
        ),
    };
}

export interface GluonProjectNameSetter {
    gluonService: GluonService;
    teamName: string;
    projectName: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export function GluonProjectNameParam(details: RecursiveParameterDetails) {
    details.setter = setGluonProjectName;
    return RecursiveParameter(details);
}

export async function setGluonTenantName(
    ctx: HandlerContext,
    commandHandler: GluonTenantNameSetter,
    selectionMessage: string = "Please select a tenant"): Promise<RecursiveSetterResult> {

    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonTenantName commandHandler requires gluonService parameter to be defined`);
    }

    const tenants = await commandHandler.gluonService.tenants.gluonTenantList();
    return {
        setterSuccess: false,
        messagePrompt: menuAttachmentForTenants(
            tenants,
            commandHandler,
            selectionMessage,
        ),
    };
}

export interface GluonTenantNameSetter {
    gluonService: GluonService;
    tenantName: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export function GluonTenantNameParam(details: RecursiveParameterDetails) {
    details.setter = setGluonTenantName;
    return RecursiveParameter(details);
}

export async function setGluonApplicationName(
    ctx: HandlerContext,
    commandHandler: GluonApplicationNameSetter,
    selectionMessage: string = "Please select an application"): Promise<RecursiveSetterResult> {
    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonApplicationName commandHandler requires gluonService parameter to be defined`);
    }

    if (commandHandler.projectName === undefined) {
        throw new QMError(`setGluonApplicationName commandHandler requires the projectName parameter to be defined`);
    }

    const applications = await commandHandler.gluonService.applications.gluonApplicationsLinkedToGluonProject(commandHandler.projectName);
    return {
        setterSuccess: false,
        messagePrompt: menuAttachmentForApplications(
            ctx,
            applications,
            commandHandler,
            selectionMessage),
    };
}

export function GluonApplicationNameParam(details: RecursiveParameterDetails) {
    details.setter = setGluonApplicationName;
    return RecursiveParameter(details);
}

export interface GluonApplicationNameSetter {
    gluonService: GluonService;
    projectName: string;
    applicationName: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export async function setDeploymentPipelineId(
    ctx: HandlerContext,
    commandHandler: DeploymentPipelineIdSetter,
    selectionMessage: string = "Please select an application"): Promise<RecursiveSetterResult> {
    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonApplicationName commandHandler requires gluonService parameter to be defined`);
    }

    if (commandHandler.projectName === undefined) {
        throw new QMError(`setGluonApplicationName commandHandler requires the projectName parameter to be defined`);
    }

    const project: QMProject = await commandHandler.gluonService.projects.gluonProjectFromProjectName(commandHandler.projectName);

    if (project.releaseDeploymentPipelines.length === 1) {
        commandHandler.deploymentPipelineId = project.releaseDeploymentPipelines[0].pipelineId;
        return {setterSuccess: true};
    } else {
        return {
            setterSuccess: false,
            messagePrompt: createSortedMenuAttachment(
                project.releaseDeploymentPipelines.map(deploymentPipeline => {
                    return {
                        value: deploymentPipeline.pipelineId,
                        text: deploymentPipeline.name,
                    };
                }),
                commandHandler,
                {
                    text: selectionMessage,
                    fallback: selectionMessage,
                    selectionMessage: "Select Deployment Pipeline",
                    resultVariableName: "deploymentPipelineId",
                },
            ),
        };
    }
}

export function DeploymentPipelineIdParam(details: RecursiveParameterDetails) {
    details.setter = setDeploymentPipelineId;
    details.showInParameterDisplay = false;
    return RecursiveParameter(details);
}

export interface DeploymentPipelineIdSetter {
    gluonService: GluonService;
    projectName: string;
    deploymentPipelineId: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}
