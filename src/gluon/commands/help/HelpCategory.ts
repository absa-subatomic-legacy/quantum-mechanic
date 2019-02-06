import * as _ from "lodash";
import {MembershipRequestClosed} from "../../events/team/MembershipRequestClosed";
import {ListExistingBitbucketProject} from "../bitbucket/BitbucketProject";
import {BitbucketProjectAccessCommand} from "../bitbucket/BitbucketProjectAccessCommand";
import {BitbucketProjectRecommendedPracticesCommand} from "../bitbucket/BitbucketProjectRecommendedPracticesCommand";
import {KickOffJenkinsBuild} from "../jenkins/JenkinsBuild";
import {JenkinsCredentialsRecreate} from "../jenkins/JenkinsCredentialsRecreate";
import {AddSlackDetails} from "../member/AddSlackDetails";
import {OnboardMember} from "../member/OnboardMember";
import {ConfigureApplicationJenkinsProd} from "../packages/ConfigureApplicationJenkinsProd";
import {ConfigureBasicPackage} from "../packages/ConfigureBasicPackage";
import {ConfigurePackage} from "../packages/ConfigurePackage";
import {CreateApplicationProd} from "../packages/CreateApplicationProd";
import {LinkExistingApplication} from "../packages/LinkExistingApplication";
import {LinkExistingLibrary} from "../packages/LinkExistingLibrary";
import {PatchBuildConfigBaseImage} from "../packages/PatchBuildConfigBaseImage";
import {AssociateTeam} from "../project/AssociateTeam";
import {CreateGenericProd} from "../project/CreateGenericProd";
import {CreateOpenShiftPvc} from "../project/CreateOpenShiftPvc";
import {CreateProject} from "../project/CreateProject";
import {CreateProjectJenkinsJob} from "../project/CreateProjectJenkinsJob";
import {CreateProjectProdEnvironments} from "../project/CreateProjectProdEnvironments";
import {NewProjectEnvironments} from "../project/NewProjectEnvironments";
import {ListProjectDetails, ListTeamProjects} from "../project/ProjectDetails";
import {ReRunProjectProdRequest} from "../project/ReRunProjectProdRequest";
import {UpdateProjectProdRequest} from "../project/UpdateProjectProdRequest";
import {AddConfigServer} from "../team/AddConfigServer";
import {AddMemberToTeam} from "../team/AddMemberToTeam";
import {AddOwnerToTeam} from "../team/AddOwnerToTeam";
import {CreateMembershipRequestToTeam} from "../team/CreateMembershipRequestToTeam";
import {CreateTeam} from "../team/CreateTeam";
import {NewDevOpsEnvironment} from "../team/DevOpsEnvironment";
import {JoinTeam} from "../team/JoinTeam";
import {LinkExistingTeamSlackChannel} from "../team/LinkExistingTeamSlackChannel";
import {ListTeamMembers} from "../team/ListTeamMembers";
import {MigrateTeamCloud} from "../team/MigrateTeamCloud";
import {NewOrUseTeamSlackChannel} from "../team/NewOrExistingTeamSlackChannel";
import {NewTeamSlackChannel} from "../team/NewSlackChannel";
import {RemoveMemberFromTeam} from "../team/RemoveMemberFromTeam";
import {TagAllLatestImages} from "../team/TagAllLatestImages";
import {TagLatestImage} from "../team/TagLatestImage";

export class HelpCategory {

    private commands: any[] = [];
    private allCommands = [
        AddConfigServer,
        AddMemberToTeam,
        AddOwnerToTeam,
        AddSlackDetails,
        AssociateTeam,
        BitbucketProjectAccessCommand,
        BitbucketProjectRecommendedPracticesCommand,
        ConfigureApplicationJenkinsProd,
        ConfigureBasicPackage,
        ConfigurePackage,
        CreateApplicationProd,
        CreateGenericProd,
        CreateMembershipRequestToTeam,
        CreateOpenShiftPvc,
        CreateProject,
        CreateProjectJenkinsJob,
        CreateProjectProdEnvironments,
        CreateTeam,
        JoinTeam,
        JenkinsCredentialsRecreate,
        KickOffJenkinsBuild,
        LinkExistingApplication,
        LinkExistingLibrary,
        LinkExistingTeamSlackChannel,
        ListExistingBitbucketProject,
        ListProjectDetails,
        ListTeamMembers,
        ListTeamProjects,
        MembershipRequestClosed,
        MigrateTeamCloud,
        NewDevOpsEnvironment,
        NewOrUseTeamSlackChannel,
        NewProjectEnvironments,
        NewTeamSlackChannel,
        OnboardMember,
        PatchBuildConfigBaseImage,
        RemoveMemberFromTeam,
        ReRunProjectProdRequest,
        TagAllLatestImages,
        TagLatestImage,
        UpdateProjectProdRequest,
    ];

    constructor(protected name, protected description, protected tags: string) {
    }

    public getHelpName() {
        return this.name;
    }

    public getHelpDescription() {
        return this.description;
    }

    public getHelpTag() {
        return this.tags;
    }

    public findListOfCommands(commandTag: string): any[] {
        for (const command of this.allCommands) {
            const classTag = this.getCommandMetadata(command.prototype);
            for (const tag of classTag.tags) {
                if (_.isEmpty(tag)) {
                    break;
                }
                if (this.forceCast<Tag>(tag).name === commandTag) {
                    this.commands.push(command);
                }
            }
        }
        return this.commands;
    }

    public findCommandByName(commandName: string) {
        for (const command of this.allCommands) {
            const commandMetaData = this.getCommandMetadata(command.prototype);

            if (commandMetaData.name === commandName) {
                return command;
            }
        }
        return null;
    }

    private getCommandMetadata(commandPrototype: any): { tags: string[], name: string } {
        if (commandPrototype.__tags === undefined) {
            return {
                tags: [],
                name: commandPrototype.__name,
            };
        }
        return {
            tags: commandPrototype.__tags,
            name: commandPrototype.__name,
        };
    }

    private forceCast<T>(input: any): T {
        return input;
    }

}

interface Tag {
    name: string;
    description: string;
}
