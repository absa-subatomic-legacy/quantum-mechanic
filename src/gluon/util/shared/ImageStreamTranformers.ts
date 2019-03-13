import {ImageStream} from "../../events/packages/package-configuration-request/PackageConfigurationRequestedEvent";

export function imageStreamToFullImageStreamTagString(imageStream: ImageStream) {
    return `${imageStream.imageName}:${imageStream.imageTag}`;
}

export function imageStreamTagStringToImageStream(fullImageStreamTag: string): ImageStream {
    const imageStreamParts = fullImageStreamTag.split(":");
    return {
        imageName: imageStreamParts[0],
        imageTag: imageStreamParts[1],
    };
}
