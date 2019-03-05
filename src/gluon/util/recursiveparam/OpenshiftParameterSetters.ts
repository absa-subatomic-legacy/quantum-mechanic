import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {Attachment} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {OpenshiftResource} from "../../../openshift/api/resources/OpenshiftResource";
import {OCService} from "../../services/openshift/OCService";
import {QMError} from "../shared/Error";
import {createMenuAttachment} from "../shared/GenericMenu";
import {getDevOpsEnvironmentDetails} from "../team/Teams";
import {
    RecursiveParameter,
    RecursiveParameterDetails,
} from "./RecursiveParameterRequestCommand";
import {RecursiveSetterResult} from "./RecursiveSetterResult";

export async function setOpenshiftTemplate(
    ctx: HandlerContext,
    commandHandler: OpenshiftTemplateSetter,
    selectionMessage: string = "Please select an Openshift template",
): Promise<RecursiveSetterResult> {

    if (commandHandler.ocService === undefined) {
        throw new QMError(`setOpenshiftTemplate commandHandler requires the ocService parameter to be defined`);
    }

    if (commandHandler.teamName === undefined) {
        throw new QMError(`setOpenshiftTemplate commandHandler requires the teamName parameter to be defined`);
    }

    await commandHandler.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].openshiftNonProd);

    const namespace = getDevOpsEnvironmentDetails(commandHandler.teamName).openshiftProjectId;
    const templates = await commandHandler.ocService.getSubatomicAppTemplates(namespace);
    return {
        setterSuccess: false,
        messagePrompt: createMenuAttachment(templates.map(template => {
                return {
                    value: template.metadata.name,
                    text: template.metadata.name,
                };
            }),
            commandHandler,
            selectionMessage,
            selectionMessage,
            "Select a template",
            "openshiftTemplate"),
    };
}

export interface OpenshiftTemplateSetter {
    ocService: OCService;
    teamName: string;
    openshiftTemplate: string;
    openShiftCloud: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export function OpenShiftTemplateParam(details: RecursiveParameterDetails) {
    details.setter = setOpenshiftTemplate;
    return RecursiveParameter(details);
}

export async function setImageName(
    ctx: HandlerContext,
    commandHandler: ImageNameSetter,
    selectionMessage: string = "Please select an image") {
    if (commandHandler.ocService === undefined) {
        throw new QMError(`setImageName commandHandler requires ocService parameter to be defined`);
    }

    await commandHandler.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].openshiftNonProd);

    const images = await commandHandler.ocService.getSubatomicImageStreamTags();

    return {
        setterSuccess: false,
        messagePrompt: presentImageMenu(ctx, commandHandler, selectionMessage, images),
    };
}

export function ImageNameParam(details: RecursiveParameterDetails) {
    details.setter = setImageName;
    return RecursiveParameter(details);
}

export async function setImageNameFromDevOps(
    ctx: HandlerContext,
    commandHandler: ImageNameSetter,
    selectionMessage: string = "Please select an image"): Promise<RecursiveSetterResult> {
    if (commandHandler.ocService === undefined) {
        throw new QMError(`setImageName commandHandler requires ocService parameter to be defined`);
    }

    if (commandHandler.teamName === undefined) {
        throw new QMError(`setImageNameFromDevOps commandHandler requires the teamName parameter to be defined`);
    }

    await commandHandler.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].openshiftNonProd);

    const devOpsEnvironment = getDevOpsEnvironmentDetails(commandHandler.teamName);

    const images = await commandHandler.ocService.getSubatomicImageStreamTags(devOpsEnvironment.openshiftProjectId);

    return {
        setterSuccess: false,
        messagePrompt: presentImageMenu(ctx, commandHandler, selectionMessage, images),
    };
}

export function ImageNameFromDevOpsParam(details: RecursiveParameterDetails) {
    details.setter = setImageNameFromDevOps;
    return RecursiveParameter(details);
}

function presentImageMenu(ctx: HandlerContext,
                          commandHandler: ImageNameSetter,
                          selectionMessage: string,
                          images: OpenshiftResource[]): Attachment {
    logger.info(JSON.stringify(images, null, 2));
    return createMenuAttachment(
        images.map(image => {
            return {
                value: image.metadata.name,
                text: image.metadata.name,
            };
        }),
        commandHandler,
        selectionMessage,
        selectionMessage,
        "Select Image",
        "imageName");
}

export interface ImageNameSetter {
    ocService: OCService;
    imageName: string;
    teamName?: string;
    openShiftCloud: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}
