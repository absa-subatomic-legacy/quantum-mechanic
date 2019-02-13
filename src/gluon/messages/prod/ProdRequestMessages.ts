import {buttonForCommand} from "@atomist/automation-client/lib/spi/message/MessageClient";
import {Attachment, SlackMessage, url} from "@atomist/slack-messages";
import {QMConfig} from "../../../config/QMConfig";
import {ConfigureApplicationJenkinsProd} from "../../commands/packages/ConfigureApplicationJenkinsProd";
import {CreateApplicationProd} from "../../commands/packages/CreateApplicationProd";
import {CreateGenericProd} from "../../commands/project/CreateGenericProd";
import {CreateProjectProdEnvironments} from "../../commands/project/CreateProjectProdEnvironments";
import {QMColours} from "../../util/QMColour";
import {ApprovalEnum} from "../../util/shared/ApprovalEnum";

export class ProdRequestMessages {
    public confirmGenericProdRequest(prodRequestCommand: CreateGenericProd): SlackMessage {

        const text: string = `By clicking Approve below you confirm that you sign off on the above resources being moved to production. Your user will be logged as the approver for this change.`;

        return {
            text,
            attachments: [{
                fallback: "Please confirm that the above resources should be moved to Prod",
                footer: `For more information, please read the ${this.docs()}`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {
                            text: "Approve Prod Request",
                            style: "primary",
                        },
                        prodRequestCommand,
                        {
                            approval: ApprovalEnum.APPROVED,
                        }),
                    buttonForCommand(
                        {
                            text: "Cancel Prod Request",
                        },
                        prodRequestCommand,
                        {
                            approval: ApprovalEnum.REJECTED,
                        }),
                ],
            }],
        };
    }

    public confirmApplicationProdRequest(prodRequestCommand: CreateApplicationProd): SlackMessage {

        const text: string = `By clicking Approve below you confirm that you sign off on the above resources being moved to production. Your user will be logged as the approver for this change.`;

        return {
            text,
            attachments: [{
                fallback: "Please confirm that the above resources should be moved to Prod",
                footer: `For more information, please read the ${this.docs()}`,
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {
                            text: "Approve Prod Request",
                            style: "primary",
                        },
                        prodRequestCommand,
                        {
                            approval: ApprovalEnum.APPROVED,
                        }),
                    buttonForCommand(
                        {
                            text: "Cancel Prod Request",
                        },
                        prodRequestCommand,
                        {
                            approval: ApprovalEnum.REJECTED,
                        }),
                ],
            }],
        };
    }

    public getProjectProdRequestAttachment(projectName: string): Attachment {
        return {
            text: `To move your applications into prod, the first step is to approve the owning project for production. \
When requesting to move a project to production, your team needs to jointly approve and certify that you want to do so. \
Once a project prod request is approved, Subatomic will create your production DevOps and project environments on all prod clusters. \
Applications can then be promoted into these production environments. To create a project production request please click the button below.
            `,
            fallback: "Create project prod request",
            footer: `For more information, please read the ${this.docs()}`,
            color: QMColours.stdMuddyYellow.hex,
            actions: [
                buttonForCommand(
                    {
                        text: "Create Prod Request",
                        style: "primary",
                    },
                    new CreateProjectProdEnvironments(),
                    {
                        projectName,
                    },
                ),
            ],
        };
    }

    public getProjectProdCompleteMessage(projectName: string): SlackMessage {

        const text: string = `
The *${projectName}* project has successfully been moved to production. \
The DevOps projects, and production environments have been created. \
You will now need to move any deployable resources into prod and create their associated Jenkins jobs.
*Please Note:* If you have not already done so, your Jenkins OpenShift client plugin needs to be configured with the correct production OpenShift cluster details. \
Contact your system admin for help if necessary.`;

        return {
            text,
            attachments: [
                this.getGenericProdCommandAttachment(projectName),
                this.getApplicationProdCommandAttachment(projectName),
            ],
        };
    }

    public getGenericProdCommandAttachment(projectName: string): Attachment {
        return {
            text: `
Creating a generic prod request will search the highest Non Prod environment in the project for all OpenShift resources. \
These resources will be recreated in all project associated Production environments. \
This will copy Subatomic created and non Subatomic resources making it the recommended initial prod request you should run. \
This is only a direct resource copy and does not configure any Jenkins jobs.
            `,
            fallback: "Create generic prod request",
            footer: `For more information, please read the ${this.docs()}`,
            color: QMColours.stdGreenyMcAppleStroodle.hex,
            actions: [
                buttonForCommand(
                    {
                        text: "Generic Prod Request",
                        style: "primary",
                    },
                    new CreateGenericProd(),
                    {
                        projectName,
                    },
                ),
            ],
        };
    }

    public getGenericProdRequestCompleteMessage(projectName: string): SlackMessage {

        const text: string = `
All OpenShift resources from the *${projectName}* project have successfully been moved to production. \
These resources may need slight tweaks for the new environments so it is recommended that you verify their correctness. \
No Jenkins jobs have been configured for any applications. It is recommended that you do that now.`;

        return {
            text,
            attachments: [
                this.getApplicationJenkinsProdCommandAttachment(projectName),
            ],
        };
    }

    public docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/`,
            "documentation")}`;
    }

    private getApplicationProdCommandAttachment(projectName: string): Attachment {
        return {
            text: `
Creating an application prod request will search the highest Non Prod environment in the project for all OpenShift resources directly associated to an application. \
The resources found are identified by traversing the resource relationships defined in the application deployment config. \
These resources will be recreated in all project associated Production environments. \
This will also configure the application Jenkins job.
            `,
            fallback: "Create application prod request",
            footer: `For more information, please read the ${this.docs()}`,
            color: QMColours.stdShySkyBlue.hex,
            actions: [
                buttonForCommand(
                    {
                        text: "Application Prod Request",
                        style: "primary",
                    },
                    new CreateApplicationProd(),
                    {
                        projectName,
                    },
                ),
            ],
        };
    }

    private getApplicationJenkinsProdCommandAttachment(projectName: string): Attachment {
        return {
            text: `
To deploy an application into your production environments you'll need to create an appropriate Jenkins job. \
All application resources should have been moved into the necessary production environments so this can be done now. \
You should run this command for all applications that need to be deployed in production now.
            `,
            fallback: "Configure Application Jenkins Prod",
            footer: `For more information, please read the ${this.docs()}`,
            color: QMColours.stdGreenyMcAppleStroodle.hex,
            actions: [
                buttonForCommand(
                    {
                        text: "Request Jenkins Job",
                        style: "primary",
                    },
                    new ConfigureApplicationJenkinsProd(),
                    {
                        projectName,
                    },
                ),
            ],
        };
    }

}
