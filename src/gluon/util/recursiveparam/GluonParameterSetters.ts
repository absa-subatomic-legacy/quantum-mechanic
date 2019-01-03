import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {menuAttachmentForApplications} from "../packages/Applications";
import {menuAttachmentForProjects, QMProject} from "../project/Project";
import {QMError} from "../shared/Error";
import {createMenuAttachment} from "../shared/GenericMenu";
import {menuAttachmentForTenants} from "../shared/Tenants";
import {menuAttachmentForTeams} from "../team/Teams";
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

    if (commandHandler.screenName === undefined) {
        throw new QMError(`setGluonTeamName commandHandler requires screenName mapped parameter to be defined`);
    }

    if (commandHandler.teamChannel !== undefined) {
        try {
            const team = await commandHandler.gluonService.teams.gluonTeamForSlackTeamChannel(commandHandler.teamChannel);
            commandHandler.teamName = team.name;
            return {setterSuccess: true};
        } catch (slackChannelError) {
            logger.info(`Could not find team associated with channel: ${commandHandler.teamChannel}. Trying to find teams member is a part of.`);
        }
    } else {
        logger.info(`CommandHandler teamChannel is undefined. Trying to find teams member is a part of.`);
    }

    const teams = await commandHandler.gluonService.teams.gluonTeamsWhoSlackScreenNameBelongsTo(commandHandler.screenName);
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
    screenName: string;
    teamName: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export async function setGluonTeamOpenShiftCloud(
    ctx: HandlerContext,
    commandHandler: GluonTeamOpenShiftCloudSetter,
    selectionMessage: string = "Please select an OpenShift cloud"): Promise<RecursiveSetterResult> {
    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonTeamName commandHandler requires gluonService parameter to be defined`);
    }

    let team;

    if (commandHandler.teamName !== undefined) {
        try {
            team = await commandHandler.gluonService.teams.gluonTeamByName(commandHandler.teamName);
        } catch (error) {
            team = undefined;
        }
    }

    if (team !== undefined) {
        commandHandler.openShiftCloud = team.openShiftCloud;
        return {setterSuccess: true};
    } else {
        return {
            setterSuccess: false,
            messagePrompt: createMenuAttachment(
                Object.keys(QMConfig.subatomic.openshiftClouds).map(cloudName => {
                    return {
                        value: cloudName,
                        text: cloudName,
                    };
                }),
                commandHandler,
                selectionMessage,
                selectionMessage,
                "Select OpenShift Cloud",
                "openShiftCloud",
            ),
        };
    }
}

export function GluonTeamOpenShiftCloudParam(details: RecursiveParameterDetails) {
    details.setter = setGluonTeamOpenShiftCloud;
    return RecursiveParameter(details);
}

export interface GluonTeamOpenShiftCloudSetter {
    gluonService: GluonService;
    teamName: string;
    openShiftCloud: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
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
            messagePrompt: createMenuAttachment(
                project.releaseDeploymentPipelines.map(deploymentPipeline => {
                    return {
                        value: deploymentPipeline.pipelineId,
                        text: deploymentPipeline.name,
                    };
                }),
                commandHandler,
                selectionMessage,
                selectionMessage,
                "Select Application/Library",
                "deploymentPipelineId",
            ),
        };
    }
}

export function DeploymentPipelineIdParam(details: RecursiveParameterDetails) {
    details.setter = setDeploymentPipelineId;
    return RecursiveParameter(details);
}

export interface DeploymentPipelineIdSetter {
    gluonService: GluonService;
    projectName: string;
    deploymentPipelineId: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}
