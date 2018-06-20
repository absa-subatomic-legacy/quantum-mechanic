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

@CommandHandler("Create a new Bitbucket project", QMConfig.subatomic.commandPrefix + " create bitbucket project")
export class CreateApplication extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "application name",
    })
    public name: string;

    @Parameter({
        description: "application description",
    })
    public description: string;

    @Parameter({
        description: "Bitbucket repository name",
    })
    public bitbucketRepositoryName: string;

    @Parameter({
        description: "Bitbucket repository URL",
    })
    public bitbucketRepositoryRepoUrl: string;

    @RecursiveParameter({
        description: "project name",
    })
    public projectName: string;

    @RecursiveParameter({
        description: "team name",
    })
    public teamName: string;

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        // get memberId for createdBy
        await ctx.messageClient.addressChannels({
            text: "🚀 Your new application is being created...",
        }, this.teamChannel);

        let member;
        try {
            member = await gluonMemberFromScreenName(ctx, this.screenName);
        } catch (error) {
            return await  logErrorAndReturnSuccess(gluonMemberFromScreenName.name, error);
        }

        let project;
        try {
            project = await gluonProjectFromProjectName(ctx, this.projectName);
        } catch (error) {
            return await logErrorAndReturnSuccess(gluonProjectFromProjectName.name, error);
        }
        const createApplicationResult = await this.createApplicationInGluon(project, member);

        if (createApplicationResult.status !== 200) {
            return await ctx.messageClient.addressChannels({
                text: "❗ Your new application could not be created. Please ensure it does not already exist.",
            }, this.teamChannel);
        }

        return await ctx.messageClient.addressChannels({
            text: "🚀 Application created successfully.",
        }, this.teamChannel);

    }

    protected async setNextParameter(ctx: HandlerContext) {
        if (_.isEmpty(this.teamName)) {
            try {
                const team = await gluonTeamForSlackTeamChannel(this.teamChannel);
                this.teamName = team.name;
            } catch (error) {
                const teams = await gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName);
                return await menuForTeams(ctx, teams, this);
            }
        }
        if (_.isEmpty(this.projectName)) {
            const projects = await gluonProjectsWhichBelongToGluonTeam(ctx, this.teamName);
            return await menuForProjects(ctx, projects, this);
        }
    }

    private async createApplicationInGluon(project, member) {
        return await axios.post(`${QMConfig.subatomic.gluon.baseUrl}/applications`,
            {
                name: this.name,
                description: this.description,
                applicationType: ApplicationType.DEPLOYABLE,
                projectId: project.projectId,
                createdBy: member.memberId,
                bitbucketRepository: {
                    name: this.bitbucketRepositoryName,
                    repoUrl: this.bitbucketRepositoryRepoUrl,
                },
                requestConfiguration: true,
            });
    }
}

@CommandHandler("Link an existing application", QMConfig.subatomic.commandPrefix + " link application")
export class LinkExistingApplication extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "application name",
    })
    public name: string;

    @Parameter({
        description: "application description",
    })
    public description: string;

    @Parameter({
        description: "team name",
        required: false,
        displayable: false,
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

        logger.debug(`Linking to Gluon project: ${this.projectName}`);

        await ctx.messageClient.addressChannels({
            text: "🚀 Your new application is being created...",
        }, this.teamChannel);

        return await this.linkApplicationForGluonProject(
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
    }

    private async linkApplicationForGluonProject(ctx: HandlerContext,
                                                 slackScreeName: string,
                                                 applicationName: string,
                                                 applicationDescription: string,
                                                 bitbucketRepositorySlug: string,
                                                 gluonProjectName: string): Promise<HandlerResult> {
        const project = await gluonProjectFromProjectName(ctx, gluonProjectName);
        logger.debug(`Linking Bitbucket repository: ${bitbucketRepositorySlug}`);

        return await this.linkBitbucketRepository(ctx,
            slackScreeName,
            applicationName,
            applicationDescription,
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
                applicationType: ApplicationType.DEPLOYABLE,
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
