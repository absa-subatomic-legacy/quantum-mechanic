import {ingester} from "@atomist/automation-client/lib/graph/graphQL";
import {QMConfig} from "./config/QMConfig";
import {ListExistingBitbucketProject} from "./gluon/commands/bitbucket/BitbucketProject";
import {BitbucketProjectAccessCommand} from "./gluon/commands/bitbucket/BitbucketProjectAccessCommand";
import {BitbucketProjectRecommendedPracticesCommand} from "./gluon/commands/bitbucket/BitbucketProjectRecommendedPracticesCommand";
import {Help} from "./gluon/commands/help/Help";
import {KickOffJenkinsBuild} from "./gluon/commands/jenkins/JenkinsBuild";
import {JenkinsCredentialsRecreate} from "./gluon/commands/jenkins/JenkinsCredentialsRecreate";
import {AddSlackDetails} from "./gluon/commands/member/AddSlackDetails";
import {OnboardMember} from "./gluon/commands/member/OnboardMember";
import {ConfigureApplicationJenkinsProd} from "./gluon/commands/packages/ConfigureApplicationJenkinsProd";
import {ConfigureBasicPackage} from "./gluon/commands/packages/ConfigureBasicPackage";
import {ConfigurePackage} from "./gluon/commands/packages/ConfigurePackage";
import {CreateApplicationProd} from "./gluon/commands/packages/CreateApplicationProd";
import {LinkExistingApplication} from "./gluon/commands/packages/LinkExistingApplication";
import {LinkExistingLibrary} from "./gluon/commands/packages/LinkExistingLibrary";
import {PatchBuildConfigBaseImage} from "./gluon/commands/packages/PatchBuildConfigBaseImage";
import {AssociateTeam} from "./gluon/commands/project/AssociateTeam";
import {CreateGenericProd} from "./gluon/commands/project/CreateGenericProd";
import {CreateOpenShiftPvc} from "./gluon/commands/project/CreateOpenShiftPvc";
import {CreateProject} from "./gluon/commands/project/CreateProject";
import {CreateProjectJenkinsJob} from "./gluon/commands/project/CreateProjectJenkinsJob";
import {CreateProjectProdEnvironments} from "./gluon/commands/project/CreateProjectProdEnvironments";
import {DefineNewProjectEnvironments} from "./gluon/commands/project/DefineNewProjectEnvironments";
import {
    ListProjectDetails,
    ListTeamProjects,
} from "./gluon/commands/project/ProjectDetails";
import {RequestProjectEnvironments} from "./gluon/commands/project/request-project-environments/RequestProjectEnvironments";
import {ReRunProjectProdRequest} from "./gluon/commands/project/ReRunProjectProdRequest";
import {UpdateProjectProdRequest} from "./gluon/commands/project/UpdateProjectProdRequest";
import {AddConfigServer} from "./gluon/commands/team/AddConfigServer";
import {AddMemberToTeam} from "./gluon/commands/team/AddMemberToTeam";
import {AddOwnerToTeam} from "./gluon/commands/team/AddOwnerToTeam";
import {CreateMembershipRequestToTeam} from "./gluon/commands/team/CreateMembershipRequestToTeam";
import {CreateTeam} from "./gluon/commands/team/CreateTeam";
import {NewDevOpsEnvironment} from "./gluon/commands/team/DevOpsEnvironment";
import {JoinTeam} from "./gluon/commands/team/JoinTeam";
import {LinkExistingTeamSlackChannel} from "./gluon/commands/team/LinkExistingTeamSlackChannel";
import {ListTeamMembers} from "./gluon/commands/team/ListTeamMembers";
import {MigrateTeamCloud} from "./gluon/commands/team/MigrateTeamCloud";
import {NewOrUseTeamSlackChannel} from "./gluon/commands/team/NewOrExistingTeamSlackChannel";
import {NewTeamSlackChannel} from "./gluon/commands/team/NewSlackChannel";
import {RemoveMemberFromTeam} from "./gluon/commands/team/RemoveMemberFromTeam";
import {TagAllLatestImages} from "./gluon/commands/team/TagAllLatestImages";
import {TagLatestImage} from "./gluon/commands/team/TagLatestImage";
import {BitbucketProjectAdded} from "./gluon/events/bitbucket/BitbucketProjectAdded";
import {TeamMemberCreated} from "./gluon/events/member/TeamMemberCreated";
import {ApplicationCreated} from "./gluon/events/packages/ApplicationCreated";
import {ApplicationProdRequested} from "./gluon/events/packages/ApplicationProdRequested";
import {PackageConfigurationRequested} from "./gluon/events/packages/package-configuration-request/PackageConfigurationRequested";
import {GenericProdRequested} from "./gluon/events/project/GenericProdRequested";
import {ProjectCreated} from "./gluon/events/project/ProjectCreated";
import {ProjectEnvironmentsRequested} from "./gluon/events/project/ProjectEnvironmentsRequested";
import {ProjectJenkinsJobRequested} from "./gluon/events/project/ProjectJenkinsJobRequested";
import {ProjectProductionEnvironmentsRequestClosed} from "./gluon/events/project/ProjectProductionEnvironmentsRequestClosed";
import {ProjectProductionEnvironmentsRequested} from "./gluon/events/project/ProjectProductionEnvironmentsRequested";
import {TeamsLinkedToProject} from "./gluon/events/project/TeamAssociated";
import {BotJoinedChannel} from "./gluon/events/team/BotJoinedChannel";
import {
    ConfigServerRequested,
    ConfigServerRequestedEvent,
} from "./gluon/events/team/ConfigServerRequested";
import {DevOpsEnvironmentRequested} from "./gluon/events/team/DevOpsEnvironmentRequested";
import {MemberRemovedFromTeam} from "./gluon/events/team/MemberRemovedFromTeam";
import {MembersAddedToTeam} from "./gluon/events/team/MembersAddedToTeam";
import {MembershipRequestClosed} from "./gluon/events/team/MembershipRequestClosed";
import {MembershipRequestCreated} from "./gluon/events/team/MembershipRequestCreated";
import {TeamCreated} from "./gluon/events/team/TeamCreated";
import {TeamOpenShiftCloudMigrated} from "./gluon/events/team/TeamOpenShiftCloudMigrated";
import {PrometheusClient} from "./gluon/metrics/prometheus/PrometheusClient";

const apiKey = QMConfig.apiKey;
const http = QMConfig.http;

export const configuration: any = {
    workspaceIds: [QMConfig.teamId],
    // running durable will store and forward events when the client is disconnected
    // this should only be used in production envs
    policy: process.env.NODE_ENV === "production" ? "durable" : "ephemeral",
    commands: [
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
        DefineNewProjectEnvironments,
        Help,
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
        RequestProjectEnvironments,
        NewTeamSlackChannel,
        OnboardMember,
        PatchBuildConfigBaseImage,
        RemoveMemberFromTeam,
        ReRunProjectProdRequest,
        TagAllLatestImages,
        TagLatestImage,
        UpdateProjectProdRequest,
    ],
    events: [
        ApplicationCreated,
        ApplicationProdRequested,
        BitbucketProjectAdded,
        BotJoinedChannel,
        ConfigServerRequested,
        DevOpsEnvironmentRequested,
        GenericProdRequested,
        MemberRemovedFromTeam,
        MembersAddedToTeam,
        MembershipRequestCreated,
        PackageConfigurationRequested,
        ProjectCreated,
        ProjectEnvironmentsRequested,
        ProjectJenkinsJobRequested,
        ProjectProductionEnvironmentsRequestClosed,
        ProjectProductionEnvironmentsRequested,
        TeamCreated,
        TeamMemberCreated,
        TeamsLinkedToProject,
        TeamOpenShiftCloudMigrated,
    ],
    ingesters: [
        ingester("KeyValuePair"),
        ingester("TeamDevOpsDetails"),
        ingester("ProjectCreatedEvent"),
        ingester("ProjectEnvironmentsRequestedEvent"),
        ingester("ProjectJenkinsJobRequestedEvent"),
        ingester("TeamsLinkedToProjectEvent"),
        ingester("SlackIdentity"),
        ingester("DeploymentEnvironment"),
        ingester("DeploymentPipeline"),
        ingester("Project"),
        ingester("ProjectBase"),
        ingester("BitbucketProject"),
        ingester("GluonTeam"),
        ingester("ActionedBy"),
        ingester("GluonTenant"),
        ingester("GluonTenantId"),
        ingester("BitbucketRepository"),
        ingester("DevOpsEnvironmentDetails"),
        ingester("GluonApplication"),
        ingester("ApplicationProdRequestedEvent"),
        ingester("TeamMemberCreatedEvent"),
        ingester("ApplicationCreatedEvent"),
        ingester("PackageConfiguredEvent"),
        ingester("GenericProdRequestedEvent"),
        ingester("TeamCreatedEvent"),
        ingester("DevOpsEnvironmentRequestedEvent"),
        ingester("DevOpsEnvironmentProvisionedEvent"),
        ingester("TeamOpenShiftCloudMigratedEvent"),
        ingester("MembershipRequestCreatedEvent"),
        ingester("MembersAddedToTeamEvent"),
        ingester("MemberRemovedFromTeamEvent"),
        ingester("BitbucketProjectAddedEvent"),
        ingester("ProjectProductionEnvironmentsRequestedEvent"),
        ingester("ProjectProductionEnvironmentsRequestClosedEvent"),
        ingester("PackageConfigurationRequestedEvent"),
        ingester("ConfigServerRequestedEvent"),
    ],
    apiKey,
    http,
    logging: {
        level: "debug",
        file: false,
        banner: true,
    },
    cluster: QMConfig.cluster,
    ws: {
        timeout: 20000,
    },
};

if (QMConfig.proMetrics.enabled) {
    PrometheusClient.initializePromClient(configuration);
}
