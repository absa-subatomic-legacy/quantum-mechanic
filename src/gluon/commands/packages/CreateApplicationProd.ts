import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
} from "@atomist/automation-client";
import _ = require("lodash");
import {OpenshiftProjectEnvironment} from "../../../config/OpenShiftConfig";
import {QMConfig} from "../../../config/QMConfig";
import {GluonService} from "../../services/gluon/GluonService";
import {OCService} from "../../services/openshift/OCService";
import {getProjectId} from "../../util/project/Project";
import {
    GluonApplicationNameSetter,
    GluonProjectNameSetter,
    GluonTeamNameSetter,
    setGluonApplicationName,
    setGluonProjectName,
    setGluonTeamName,
} from "../../util/recursiveparam/GluonParameterSetters";
import {
    RecursiveParameter,
    RecursiveParameterRequestCommand,
} from "../../util/recursiveparam/RecursiveParameterRequestCommand";
import {
    handleQMError,
    QMError,
    ResponderMessageClient,
} from "../../util/shared/Error";

@CommandHandler("Create application to prod", QMConfig.subatomic.commandPrefix + " request application prod")
export class CreateApplicationProd extends RecursiveParameterRequestCommand
    implements GluonTeamNameSetter, GluonProjectNameSetter, GluonApplicationNameSetter {

    private static RecursiveKeys = {
        teamName: "TEAM_NAME",
        applicationName: "APPLICATION_NAME",
        projectName: "PROJECT_NAME",
        packageType: "PACKAGE_TYPE",
        packageDefinition: "PACKAGE_DEFINITION",
    };

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @RecursiveParameter({
        recursiveKey: CreateApplicationProd.RecursiveKeys.teamName,
        selectionMessage: "Please select a team associated with the project you wish to configure the package for",
    })
    public teamName: string;

    @RecursiveParameter({
        recursiveKey: CreateApplicationProd.RecursiveKeys.applicationName,
        selectionMessage: "Please select the package you wish to configure",
    })
    public applicationName: string;

    @RecursiveParameter({
        recursiveKey: CreateApplicationProd.RecursiveKeys.projectName,
        selectionMessage: "Please select the owning project of the package you wish to configure",
    })
    public projectName: string;

    constructor(public gluonService = new GluonService(), public ocService = new OCService()) {
        super();
    }

    protected async runCommand(ctx: HandlerContext): Promise<HandlerResult> {
        // get memberId for createdBy
        try {
            await ctx.messageClient.respond({
                text: "🚀 Finding available resources...",
            });

            const project = await this.gluonService.projects.gluonProjectFromProjectName(this.projectName);

            const tenant = await this.gluonService.tenants.gluonTenantFromTenantId(project.owningTenant);

            const resources = await this.ocService.exportAllResources(getProjectId(tenant.name, project.name, this.getPreProdEnvironment().id));

            const applicationDc = this.findApplicationDeploymentConfig(this.applicationName, resources);

            logger.info(resources);

            return await ctx.messageClient.respond({
                text: "🚀 Resources found successfully",
            });
        } catch (error) {
            return await handleQMError(new ResponderMessageClient(ctx), error);
        }
    }

    protected configureParameterSetters() {
        this.addRecursiveSetter(CreateApplicationProd.RecursiveKeys.teamName, setGluonTeamName);
        this.addRecursiveSetter(CreateApplicationProd.RecursiveKeys.projectName, setGluonProjectName);
        this.addRecursiveSetter(CreateApplicationProd.RecursiveKeys.applicationName, setGluonApplicationName);
    }

    private getPreProdEnvironment(): OpenshiftProjectEnvironment {
        const nEnvironments = QMConfig.subatomic.openshiftNonProd.defaultEnvironments.length;
        return QMConfig.subatomic.openshiftNonProd.defaultEnvironments[nEnvironments - 1];
    }

    private findApplicationDeploymentConfig(applicationName: string, openshiftResources) {
        const kebabbedName = _.kebabCase(applicationName.toLowerCase());

        for (const resource of openshiftResources.items) {
            if (resource.kind === "DeploymentConfig" && resource.metadata.name === kebabbedName) {
                return resource;
            }
        }

        throw new QMError("Failed to find DeploymentConfig for selected application.");
    }

    /*
    Find DC
        look through spec>template>volumes>pvc get list of pvc
        look through spec>triggers>imageChangeParams>from for imagestreams or just create
    Find Services
        match to dc using spec>selector>name and compare to dc name
    Find Routes
        match to service using spec>to>name and compare to service name
     */

}
