import {
    HandlerContext,
    logger,
    Parameter,
    Tags,
} from "@atomist/automation-client";
import {CommandHandler} from "@atomist/automation-client/lib/decorators";
import {OpenShiftConfig} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {isSuccessCode} from "../../../http/Http";
import {GluonService} from "../../services/gluon/GluonService";
import {QMDeploymentPipeline} from "../../util/project/Project";
import {
    GluonTeamNameParam,
    GluonTeamNameSetter,
    GluonTenantNameParam,
    GluonTenantNameSetter,
} from "../../util/recursiveparam/GluonParameterSetters";
import {RecursiveParameterRequestCommand} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";
import {QMTeam} from "../../util/team/Teams";

@CommandHandler("Create a new project", QMConfig.subatomic.commandPrefix + " create project")
@Tags("subatomic", "project", "team")
export class CreateProject extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonTenantNameSetter {

    @Parameter({
        description: "project name",
    })
    public name: string;

    @Parameter({
        description: "project description",
    })
    public description: string;

    @GluonTeamNameParam({
        callOrder: 0,
        selectionMessage: "Please select a team you would like to associate this project with",
    })
    public teamName: string;

    @GluonTenantNameParam({
        callOrder: 1,
        selectionMessage: "Please select a tenant you would like to associate this project with. Choose Default if you have no tenant specified for this project.",
    })
    public tenantName: string;

    constructor(public gluonService = new GluonService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext) {
        try {
            const tenant = await this.gluonService.tenants.gluonTenantFromTenantName(this.tenantName);
            const result = await this.requestNewProjectForTeamAndTenant(ctx, this.screenName, this.teamName, tenant.tenantId);
            this.succeedCommand();
            return result;
        } catch (error) {
            this.failCommand();
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    private async requestNewProjectForTeamAndTenant(ctx: HandlerContext, screenName: string,
                                                    teamName: string, tenantId: string): Promise<any> {

        const member = await this.gluonService.members.gluonMemberFromScreenName(screenName);

        const team: QMTeam = await this.gluonService.teams.gluonTeamByName(teamName);

        await this.createGluonProject(
            {
                name: this.name,
                description: this.description,
                createdBy: member.memberId,
                owningTenant: tenantId,
                teams: [{
                    teamId: team.teamId,
                }],
                devDeploymentPipeline: this.getDefaultDevDeploymentPipeline(QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd),
                releaseDeploymentPipelines: [this.getDefaultReleaseDeploymentPipeline(QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd)],
            });

        return await ctx.messageClient.respond("🚀Project successfully created.");
    }

    private getDefaultDevDeploymentPipeline(openshiftNonProd: OpenShiftConfig) {
        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            environments: [],
        };
        for (let i = 0; i < openshiftNonProd.defaultEnvironments.length - 1; i++) {
            const environment = openshiftNonProd.defaultEnvironments[i];
            deploymentPipeline.environments.push(
                {
                    positionInPipeline: i,
                    displayName: environment.description,
                    postfix: environment.id,
                },
            );
        }
        return deploymentPipeline;
    }

    private getDefaultReleaseDeploymentPipeline(openshiftNonProd: OpenShiftConfig) {
        const deploymentPipeline: QMDeploymentPipeline = {
            name: "Default",
            tag: "",
            environments: [],
        };
        const environment = openshiftNonProd.defaultEnvironments[openshiftNonProd.defaultEnvironments.length - 1];
        deploymentPipeline.environments.push(
            {
                positionInPipeline: deploymentPipeline.environments.length,
                displayName: environment.description,
                postfix: environment.id,
            },
        );

        return deploymentPipeline;
    }

    private async createGluonProject(projectDetails) {
        const projectCreationResult = await this.gluonService.projects.createGluonProject(
            projectDetails);
        if (projectCreationResult.status === 409) {
            logger.error(`Failed to create project since the project name is already in use.`);
            throw new QMError(`Failed to create project since the project name is already in use. Please retry using a different project name.`);
        } else if (!isSuccessCode(projectCreationResult.status)) {
            logger.error(`Failed to create project with error: ${JSON.stringify(projectCreationResult.data)}`);
            throw new QMError(`Failed to create project.`);
        }
    }
}
