import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {menuForProjects} from "../project/Project";
import {QMError} from "../shared/Error";
import {createMenu} from "../shared/GenericMenu";
import {menuForTenants} from "../shared/Tenants";
import {menuForTeams} from "../team/Teams";

export async function setGluonTeamName(
    ctx: HandlerContext,
    commandHandler: { gluonService: GluonService, teamChannel?: string, screenName: string, teamName: string, handle: (ctx: HandlerContext) => Promise<HandlerResult> },
    selectionMessage: string = "Please select a team") {
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
            return await commandHandler.handle(ctx);
        } catch (slackChannelError) {
            logger.info(`Could not find team associated with channel: ${commandHandler.teamChannel}. Trying to find teams member is a part of.`);
        }
    } else {
        logger.info(`CommandHandler teamChannel is undefined. Trying to find teams member is a part of.`);
    }

    const teams = await commandHandler.gluonService.teams.gluonTeamsWhoSlackScreenNameBelongsTo(commandHandler.screenName);
    return await menuForTeams(
        ctx,
        teams,
        commandHandler,
        selectionMessage);
}

export async function setImageName(
    ctx: HandlerContext,
    commandHandler: { ocService: OCService, handle: (ctx: HandlerContext) => Promise<HandlerResult> },
    selectionMessage: string = "Please select an image") {
    if (commandHandler.ocService === undefined) {
        throw new QMError(`setImageName commandHandler requires ocService parameter to be defined`);
    }

    const imagesResult = await commandHandler.ocService.getSubatomicImageStreamTags();
    const images = JSON.parse(imagesResult.output).items;
    return await createMenu(
        ctx,
        images.map(image => {
            return {
                value: image.metadata.name,
                text: image.metadata.name,
            };
        }),
        commandHandler,
        selectionMessage,
        "Select Image",
        "imageName");
}

export async function setGluonProjectName(
    ctx: HandlerContext,
    commandHandler: { gluonService: GluonService, teamName: string, handle: (ctx: HandlerContext) => Promise<HandlerResult> },
    selectionMessage: string = "Please select a project") {

    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonProject commandHandler requires gluonService parameter to be defined`);
    }

    if (commandHandler.teamName === undefined) {
        throw new QMError(`setGluonProject commandHandler requires the teamName parameter to be defined`);
    }

    const projects = await commandHandler.gluonService.projects.gluonProjectsWhichBelongToGluonTeam(commandHandler.teamName);
    return await menuForProjects(
        ctx,
        projects,
        commandHandler,
        selectionMessage,
    );
}

export async function setGluonTenantName(
    ctx: HandlerContext,
    commandHandler: { gluonService: GluonService, handle: (ctx: HandlerContext) => Promise<HandlerResult> },
    selectionMessage: string = "Please select a tenant") {

    if (commandHandler.gluonService === undefined) {
        throw new QMError(`setGluonTenantName commandHandler requires gluonService parameter to be defined`);
    }

    const tenants = await commandHandler.gluonService.tenants.gluonTenantList();
    return await menuForTenants(ctx,
        tenants,
        commandHandler,
        selectionMessage,
    );
}
