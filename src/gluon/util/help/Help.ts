import {
    CommandHandler,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import uuid = require("uuid");
import {QMConfig} from "../../../config/QMConfig";
import {AddMemberToTeam} from "../../commands/team/AddMemberToTeam";
import {handleQMError, ResponderMessageClient} from "../shared/Error";
import {HelpCategory} from "./HelpCategory";

@CommandHandler("Help regarding subatomic commands", QMConfig.subatomic.commandPrefix + " help")
export class Help implements HandleCommand<HandlerResult> {

    @Parameter({
        description: "Option selected",
        required: false,
    })
    public selectedOption: string;

    @Parameter({
        description: "Option description selected",
        required: false,
    })
    public selectedDescription: string;

    @Parameter({
        description: "Class of command to be run",
        required: false,
    })
    public commandOfClass: any;

    @Parameter({
        description: "correlation id of the message that invoked this command",
        required: false,
    })
    public correlationId: string;

    public optionsAttachments: any = [];
    public optionFolders = [
        new HelpCategory("Bitbucket", "These commands do bitbucket stuff", "bitbucket"),
        new HelpCategory("Jenkins", "These commands do jenkins things", "jenkins"),
        new HelpCategory("Member", "These commands do member stuff", "member"),
        new HelpCategory("Package", "These commands do package stuff", "package"),
        new HelpCategory("Project", "These commands do project stuff", "project"),
        new HelpCategory("Team", "These commands do team stuff", "team"),
        new HelpCategory("Other", "Other stuff", "other"),
    ];
    public commands: any = [];

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            if (this.correlationId === undefined) {
                this.correlationId = uuid();
            }
            logger.info(`Category: ${this.selectedOption} clicked`);
            if (this.selectedOption === undefined) {
                for (const option of this.optionFolders) {
                    this.folderOptions(option.getHelpName(), option.getHelpDescription());
                }
                return await ctx.messageClient.respond({
                    text: "What would you like to do?",
                    attachments: this.optionsAttachments,
                }, {id: this.correlationId});
            } else if (this.selectedOption.includes("sub")) {
                logger.info(`!@!${this.commandOfClass}`);
                return await ctx.messageClient.respond({
                    text: `\`${this.selectedOption}\` - ${this.selectedDescription}`,
                    attachments: [
                        {
                            text: "",
                            fallback: "",
                            mrkdwn_in: ["text"],
                            actions: [
                                buttonForCommand(
                                    {
                                        text: "Confirm",
                                    },
                                    new this.commandOfClass(), {correlationId: this.correlationId}),
                            ],
                        }],
                }, {id: this.correlationId});
            } else {
                this.optionsAttachments = [];
                for (const commandClass of this.optionFolders) {
                    if (commandClass.getHelpName() === this.selectedOption) {
                        this.commands = commandClass.findListOfCommands(commandClass.getHelpName().toLowerCase());
                        // Constructs each command
                        for (const command of this.commands) {
                            this.commandOptions(this.getCommandHandlerMetadata(command.prototype), command);
                        }
                        break;
                    }
                }
                return await ctx.messageClient.respond({
                    text: `*${this.selectedOption}*`,
                    attachments: this.optionsAttachments,
                }, {id: this.correlationId});
            }

        } catch (error) {
            return await this.handleError(ctx, error);
        }
    }

    private folderOptions(option: string, optionDescription: string) {
        this.optionsAttachments.push({
            text: `*${optionDescription}*`,
            fallback: "",
            mrkdwn_in: ["text"],
            actions: [
                buttonForCommand(
                    {
                        text: option,
                    },
                    new Help(), {selectedOption: option, correlationId: this.correlationId}),
            ],
        });
    }

    private commandOptions(commandMetadata: any, command: any) {
        logger.info(`----${command}`);
        this.optionsAttachments.push({
            text: `\`${commandMetadata.intent}\` - ${commandMetadata.description}`,
            fallback: "",
            mrkdwn_in: ["text"],
            actions: [
                buttonForCommand(
                    {
                        text: "Press me",
                    },
                    new Help(), {
                        selectedOption: `${commandMetadata.intent}`,
                        selectedDescription: `${commandMetadata.description}`,
                        commandOfClass: command,
                        correlationId: this.correlationId,
                    }),
            ],
        });
    }

    private async executeCommand(ctx: HandlerContext) {
        // await ctx.messageClient.respond({
        //     text: `*$Sub help*`,
        // }, {id: this.correlationId});
    }

    private async handleError(ctx: HandlerContext, error) {
        const messageClient = new ResponderMessageClient(ctx);
        return await handleQMError(messageClient, error);
    }

    private getCommandHandlerMetadata(commandHandlerPrototype: any): { intent: string, description: string } {
        return {
            intent: commandHandlerPrototype.__intent,
            description: commandHandlerPrototype.__description,
        };
    }
}
