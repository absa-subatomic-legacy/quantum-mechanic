import {url} from "@atomist/slack-messages";
import _ = require("lodash");
import {QMConfig} from "../../../config/QMConfig";
import {CommandDocumentationLink} from "./CommandDocumentationLink";

export class DocumentationUrlBuilder {

    /**
     * Expects command intent without the subatomic prefix and will return the documentation URL for the command
     * @param commandIntent - command intent without the subatomic prefix
     * @param urlLabel - user friendly display name for the url hyper link
     */
    public static commandReference(commandIntent: CommandDocumentationLink, urlLabel = "documentation") {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference/#sub-${_.kebabCase(commandIntent.toString())}`,
            urlLabel)}`;
    }

    public static generalCommandReference(urlLabel = "documentation") {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference/}`,
            urlLabel)}`;
    }

    public static userGuide(urlLabel = "user guide") {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/user-guide/overview/`,
            urlLabel)}`;
    }
}
