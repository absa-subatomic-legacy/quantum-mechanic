import {QMConfig} from "../../config/QMConfig";

export enum CommandIntent {
    AddConfigServer = "add config server",
    AddMemberToTeam = "add team member",
    AddOwnerToTeam = "add team owner",
    AssociateTeam = "associate team",
    BitbucketProjectAccessCommand = "configure project bitbucket access",
    BitbucketProjectRecommendedPracticesCommand = "apply bitbucket practices",
    ConfigureBasicPackage = "configure package",
    ConfigurePackage = "configure custom package",
    ConfigureApplicationJenkinsProd = "configure application jenkins prod",
    CreateApplicationProd = "request application prod",
    CreateGenericProd = "request generic prod",
    JenkinsCredentialsRecreate = "create jenkins default credentials",
    CreateOpenShiftPvc = "create openshift pvc",
    CreateProject = "create project",
    CreateProjectJenkinsJob = "project request jenkins job",
    CreateProjectProdEnvironments = "request project prod",
    CreateTeam = "create team",
    Help = "help",
    JoinTeam = "apply to team",
    KickOffJenkinsBuild = "jenkins build",
    LinkExistingBitbucketProject = "link bitbucket project",
    LinkExistingApplication = "link application",
    LinkExistingLibrary = "link library",
    LinkExistingTeamSlackChannel = "link team channel",
    ListTeamMembers = "list team members",
    ListTeamProjects = "list projects",
    MigrateTeamCloud = "team migrate cloud",
    NewDevOpsEnvironment = "request devops environment",
    NewTeamSlackChannel = "create team channel",
    OnboardMember = "onboard me",
    PatchBuildConfigBaseImage = "patch package s2i image",
    RequestProjectEnvironments = "request project environments",
    RemoveMemberFromTeam = "remove team member",
}

export function atomistIntent(baseIntent: CommandIntent) {
    return `${QMConfig.subatomic.commandPrefix} ${baseIntent.toString()}`;
}
