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
        description: "Previous option selected for menu purpose",
        required: false,
    })
    public prevSelectedOption: string;

    @Parameter({
        description: "Option description selected",
        required: false,
    })
    public selectedDescription: string;

    @Parameter({
        description: "Class of command to be run",
        required: false,
    })
    public commandClassName: string;

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
    public absaColors = [
        "#ff780f", "#fa551e",
        "#f52d28", "#dc0032",
        "#be0028", "#aa052d",
        "#960528", "#f05a7d",
        "#f0325a", "#af144b",
        "#870a3c", "#640032",
        "#500a28", "#000000",
    ];
    public colorCount = 0;

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        try {
            if (this.correlationId === undefined) {
                this.correlationId = uuid();
            }
            logger.info(`Category: ${this.selectedOption} clicked`);
            if (this.selectedOption === undefined) {
                for (const option of this.optionFolders) {
                    this.folderOptions(option.getHelpName(), option.getHelpDescription());
                    this.colorCount++;
                }
                return await ctx.messageClient.respond({
                    text: "What would you like to do?",
                    attachments: this.optionsAttachments,
                }, {id: this.correlationId});
            } else if (this.selectedOption.includes("sub")) {
                this.finalMenuStep();
                return await ctx.messageClient.respond({
                    text: `\`${this.selectedOption}\` - ${this.selectedDescription}`,
                    attachments: this.optionsAttachments,
                }, {id: this.correlationId});
            } else {
                this.optionsAttachments = [];
                for (const commandClass of this.optionFolders) {
                    if (commandClass.getHelpName() === this.selectedOption) {
                        this.commands = commandClass.findListOfCommands(commandClass.getHelpName().toLowerCase());
                        for (const command of this.commands) {
                            this.commandOptions(this.getCommandHandlerMetadata(command.prototype), command);
                            this.colorCount++;
                        }
                        break;
                    }
                }
                this.returnMenuButton(undefined, undefined, "Main");

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
            color: this.absaColors[this.colorCount],
            mrkdwn_in: ["text"],
            actions: [
                buttonForCommand(
                    {
                        text: option,
                        style: "primary",
                    },
                    new Help(), {selectedOption: option, correlationId: this.correlationId}),
            ],
        });
    }

    private commandOptions(commandMetadata: any, command: any) {
        this.optionsAttachments.push({
            text: `\`${commandMetadata.intent}\` - ${commandMetadata.description}`,
            fallback: "",
            color: this.absaColors[this.colorCount],
            mrkdwn_in: ["text"],
            actions: [
                buttonForCommand(
                    {
                        text: commandMetadata.intent,
                        style: "primary",
                    },
                    new Help(), {
                        selectedOption: `${commandMetadata.intent}`,
                        selectedDescription: `${commandMetadata.description}`,
                        commandClassName: command.prototype.__name,
                        prevSelectedOption: this.selectedOption,
                        correlationId: this.correlationId,
                    }),
            ],
        });
    }

    private finalMenuStep() {
        this.optionsAttachments.push({
            text: "",
            fallback: "",
            color: this.absaColors[this.colorCount],
            mrkdwn_in: ["text"],
            actions: [
            buttonForCommand(
                {
                    text: "Run Command",
                    style: "primary",
                    confirm: {text: `You are about to run \`${this.selectedOption}\`.`},
                },
                this.optionFolders[0].findCommandByName(this.commandClassName), {correlationId: this.correlationId}),
            ],
        },
        );
        this.colorCount++;
        this.returnMenuButton(this.prevSelectedOption, undefined, this.prevSelectedOption);
    }

    private returnMenuButton(option: string, desc: string, menu: string) {
        this.optionsAttachments.push({
            text: "",
            fallback: "",
            color: this.absaColors[this.colorCount],
            mrkdwn_in: ["text"],
            actions: [
                buttonForCommand(
                    {
                        text: `:arrow_left: Return to ${menu} menu`,
                    },
                    new Help(), {
                        selectedOption: option,
                        selectedDescription: desc,
                        correlationId: this.correlationId,
                    }),
            ],
        });
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
