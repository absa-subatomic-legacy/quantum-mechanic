import {logger} from "@atomist/automation-client";
import _ = require("lodash");
import {OpenShiftApi} from "@absa-subatomic/openshift-api/build/src/OpenShiftApi";
import {OpenshiftResource} from "@absa-subatomic/openshift-api/build/src/resources/OpenshiftResource";
import {inspect} from "util";
import {isSuccessCode} from "../../../http/Http";
import {QMError} from "../../util/shared/Error";

export class OCImageService {

    get openShiftApi(): OpenShiftApi {
        if (this.openShiftApiInstance === undefined) {
            logger.error(`Failed to access the openShiftApiInstance. Make sure the you have performed an OCService.setOpenShiftDetails command`);
            throw new QMError("OpenShift login failure!");
        }
        return this.openShiftApiInstance;
    }

    set openShiftApi(value: OpenShiftApi) {
        this.openShiftApiInstance = value;
    }

    private openShiftApiInstance: OpenShiftApi;

    public async getAllSubatomicImageStreams(namespace: string = "subatomic", cleanNamespace: boolean = true): Promise<OpenshiftResource[]> {
        logger.debug(`Trying to get subatomic image stream from subatomic namespace`);
        const queryResult = await this.openShiftApi.get.getAllFromNamespace("ImageStream", "subatomic", "v1");

        if (isSuccessCode(queryResult.status)) {
            const imageStreams = [];
            for (const imageStream of queryResult.data.items) {
                if (imageStream.metadata.labels !== undefined) {
                    if (imageStream.metadata.labels.usage === "subatomic-is") {
                        imageStream.kind = "ImageStream";
                        if (cleanNamespace) {
                            delete imageStream.metadata.namespace;
                        }
                        imageStreams.push(imageStream);
                    }
                }
            }
            return imageStreams;
        } else {
            logger.error(`Failed to find Subatomic Image Streams in the specified namespace: ${inspect(queryResult)}`);
            throw new QMError("Failed to find Subatomic Image Streams in the specified namespace");
        }
    }

    public async getImageStream(imageStreamName: string, namespace: string = "subatomic", cleanNamespace: boolean = true): Promise<OpenshiftResource> {
        logger.debug(`Trying to get subatomic image stream from subatomic namespace`);
        const queryResult = await this.openShiftApi.get.get("ImageStream", imageStreamName, "subatomic", "v1");

        if (isSuccessCode(queryResult.status)) {
            const imageStream = queryResult.data;

            if (cleanNamespace) {
                delete imageStream.metadata.namespace;
            }

            return imageStream;
        } else {
            logger.error(`Failed to find Image Stream in the specified namespace: ${inspect(queryResult)}`);
            throw new QMError("Failed to find Subatomic Image in the specified namespace");
        }
    }

    public modifyImageStreamTagToImportIntoNamespace(imageStreamTagOriginal: OpenshiftResource, namespace: string) {
        const imageStreamTag = _.cloneDeep(imageStreamTagOriginal);
        const dockerImageReference: string[] = imageStreamTag.image.dockerImageReference.split("/");
        const originalNamespace = dockerImageReference[1];
        const imageName = dockerImageReference[2];
        imageStreamTag.lookupPolicy = {
            local: false,
        };
        imageStreamTag.referencePolicy = {
            type: "Source",
        };
        imageStreamTag.metadata = {
            namespace,
            name: imageStreamTag.metadata.name,
            creationTimestamp: null,
        };
        imageStreamTag.tag = {
            name: "",
            annotations: null,
            from: {
                kind: "ImageStreamImage",
                namespace: originalNamespace,
                name: imageName,
            },
            generation: null,
            importPolicy: {},
            referencePolicy: {
                type: "Source",
            },
        };
        imageStreamTag.apiVersion = "v1";

        return imageStreamTag;
    }

}
