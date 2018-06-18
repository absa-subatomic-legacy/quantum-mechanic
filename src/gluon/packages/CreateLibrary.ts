import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    success,
} from "@atomist/automation-client";
import axios from "axios";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {
    bitbucketRepositoriesForProjectKey,
    bitbucketRepositoryForSlug,
    menuForBitbucketRepositories,
} from "../bitbucket/Bitbucket";
import {gluonMemberFromScreenName} from "../member/Members";
import {
    gluonProjectFromProjectName,
    gluonProjectsWhichBelongToGluonTeam,
    menuForProjects,
} from "../project/Projects";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../shared/RecursiveParameterRequestCommand";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo,
    menuForTeams,
} from "../team/Teams";
import {ApplicationType} from "./Applications";

@CommandHandler("Link an existing library", QMConfig.subatomic.commandPrefix + " link library")
export class LinkExistingLibrary extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "library name",
    })
    public name: string;

    @Parameter({
        description: "library description",
    })
    public description: string;

    @Parameter({
        description: "team name",
        displayable: false,
        required: false,
    })
    public teamName: string;

    @RecursiveParameter({
        description: "project name",
    })
    public projectName: string;

    @RecursiveParameter({
        description: "Bitbucket repository slug",
    })
    public bitbucketRepositorySlug: string;

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        await ctx.messageClient.addressChannels({
            text: "🚀 Your new library is being created...",
        }, this.teamChannel);

        return await this.linkLibraryForGluonProject(
            ctx,
            this.screenName,
            this.name,
            this.description,
            this.bitbucketRepositorySlug,
            this.projectName,
        );
    }

    protected async setNextParameter(ctx: HandlerContext): Promise<HandlerResult> {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
                return await this.setNextParameter(ctx);
            } catch (error) {
                const teams = await gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
                return menuForTeams(
                    ctx,
                    teams,
                    this,
                    "Please select a team, whose project you would like to link a library to");

            }
        }
        if (_.isEmpty(this.projectName)) {
            const projects = await gluonProjectsWhichBelongToGluonTeam(ctx, this.teamName);
            return menuForProjects(
                ctx,
                projects,
                this,
                "Please select a project to which you would like to link a library to");
        }
        if (_.isEmpty(this.bitbucketRepositorySlug)) {
            const project = await gluonProjectFromProjectName(ctx, this.projectName);
            if (_.isEmpty(project.bitbucketProject)) {
                return await ctx.messageClient.respond(`❗The selected project does not have an associated bitbucket project. Please first associate a bitbucket project using the \`${QMConfig.subatomic.commandPrefix} link bitbucket project\` command.`);
            }
            const bitbucketRepos = await bitbucketRepositoriesForProjectKey(project.bitbucketProject.key);
            logger.debug(`Bitbucket project [${project.bitbucketProject.name}] has repositories: ${JSON.stringify(bitbucketRepos)}`);

            return await menuForBitbucketRepositories(
                ctx,
                bitbucketRepos,
                this,
                "Please select the Bitbucket repository which contains the library you want to link",
                "bitbucketRepositorySlug",
                "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/atlassian-bitbucket-logo.png",
            );
        }
        return success();
    }

    private async linkLibraryForGluonProject(ctx: HandlerContext,
                                             slackScreeName: string,
                                             libraryName: string,
                                             libraryDescription: string,
                                             bitbucketRepositorySlug: string,
                                             gluonProjectName: string): Promise<HandlerResult> {
        const project = await gluonProjectFromProjectName(ctx, gluonProjectName);
        logger.debug(`Linking Bitbucket repository: ${bitbucketRepositorySlug}`);

        return await this.linkBitbucketRepository(ctx,
            slackScreeName,
            libraryName,
            libraryDescription,
            bitbucketRepositorySlug,
            project.bitbucketProject.key,
            project.projectId);
    }

    private async linkBitbucketRepository(ctx: HandlerContext,
                                          slackScreeName: string,
                                          libraryName: string,
                                          libraryDescription: string,
                                          bitbucketRepositorySlug: string,
                                          bitbucketProjectKey: string,
                                          gluonProjectId: string): Promise<HandlerResult> {
        const repo = await bitbucketRepositoryForSlug(bitbucketProjectKey, bitbucketRepositorySlug);
        let member;
        try {
            member = await gluonMemberFromScreenName(ctx, slackScreeName);
        } catch (error) {
            return await logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
        }
        const remoteUrl = _.find(repo.links.clone, clone => {
            return (clone as any).name === "ssh";
        }) as any;

        const createApplicationResult = await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/applications`,
            {
                name: libraryName,
                description: libraryDescription,
                applicationType: ApplicationType.LIBRARY,
                projectId: gluonProjectId,
                createdBy: member.memberId,
                bitbucketRepository: {
                    bitbucketId: repo.id,
                    name: repo.name,
                    slug: bitbucketRepositorySlug,
                    remoteUrl: remoteUrl.href,
                    repoUrl: repo.links.self[0].href,
                },
                requestConfiguration: true,
            });

        if (createApplicationResult.status !== 200) {
            logger.error(`Failed to link package. Error: ${JSON.stringify(createApplicationResult)}`);
            return await ctx.messageClient.respond("❗Failed to link the specified package.");
        }

        return await success();
    }

}
