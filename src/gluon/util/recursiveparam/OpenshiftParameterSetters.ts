import {
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {Attachment} from "@atomist/slack-messages";
import {OpenshiftResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {QMConfig} from "../../../config/QMConfig";

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

    if (commandHandler.openShiftCloud === undefined) {
        throw new QMError(`setOpenshiftTemplate commandHandler requires the openShiftCloud parameter to be defined`);
    }

    await commandHandler.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].openshiftNonProd);

    const namespace = QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].sharedResourceNamespace;
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

export async function setImageStreamTag(
    ctx: HandlerContext,
    commandHandler: ImageTagSetter,
    selectionMessage: string = "Please select an image tag") {
    if (commandHandler.ocService === undefined) {
        throw new QMError(`setImageStreamTag commandHandler requires ocService parameter to be defined`);
    }

    if (commandHandler.imageName === undefined) {
        throw new QMError(`setImageStreamTag commandHandler requires imageName parameter to be defined`);
    }

    await commandHandler.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].openshiftNonProd);

    const image: OpenshiftResource = await commandHandler.ocService.getImageStream(commandHandler.imageName, QMConfig.subatomic.openshiftClouds[commandHandler.openShiftCloud].sharedResourceNamespace);

    return {
        setterSuccess: false,
        messagePrompt: presentImageTagMenu(ctx, commandHandler, selectionMessage, image.status.tags),
    };
}

export function ImageStreamTagParam(details: RecursiveParameterDetails) {
    details.setter = setImageStreamTag;
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

function presentImageTagMenu(ctx: HandlerContext,
                             commandHandler: ImageNameSetter,
                             selectionMessage: string,
                             imageStreamTags: any[]): Attachment {
    logger.info(JSON.stringify(imageStreamTags, null, 2));
    return createMenuAttachment(
        imageStreamTags.map(imageTag => {
            return {
                value: imageTag.tag,
                text: imageTag.tag,
            };
        }),
        commandHandler,
        selectionMessage,
        selectionMessage,
        "Select Image Tag",
        "imageTag");
}

export interface ImageNameSetter {
    ocService: OCService;
    imageName: string;
    teamName?: string;
    openShiftCloud: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}

export interface ImageTagSetter {
    ocService: OCService;
    imageName: string;
    imageTag: string;
    openShiftCloud: string;
    handle: (ctx: HandlerContext) => Promise<HandlerResult>;
}
