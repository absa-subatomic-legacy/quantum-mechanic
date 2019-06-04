import {logger} from "@atomist/automation-client";
import {QMConfig} from "../../../config/QMConfig";
import {QMContext} from "../../../context/QMContext";
import {GluonService} from "../../services/gluon/GluonService";
import {
    JenkinsCredentialsAction,
    JenkinsDevOpsCredentialsService,
} from "../../services/jenkins/JenkinsDevOpsCredentialsService";
import {OCService} from "../../services/openshift/OCService";
import {getSubatomicJenkinsServiceAccountName} from "../../util/jenkins/Jenkins";
import {
    getOpenshiftProductionDevOpsJenkinsTokenCredential,
    JenkinsCredentials,
} from "../../util/jenkins/JenkinsCredentials";
import {
    getDevOpsEnvironmentDetails,
    getDevOpsEnvironmentDetailsProd,
    QMTeam,
} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class RecreateJenkinsDevOpsCredentials extends Task {

    private readonly TASK_CREATE_STANDARD_CREDENTIALS = TaskListMessage.createUniqueTaskName("CreateStandardCredentials");
    private readonly TASK_CREATE_PRODUCTION_CREDENTIALS = TaskListMessage.createUniqueTaskName("CreateProductionCredentials");

    constructor(private gluonTeamName,
                private gluonService = new GluonService(),
                private ocService = new OCService(),
                private jenkinsDevOpsCredentialsService = new JenkinsDevOpsCredentialsService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_CREATE_STANDARD_CREDENTIALS, `\tCreate standard Jenkins credentials`);
        taskListMessage.addTask(this.TASK_CREATE_PRODUCTION_CREDENTIALS, `\tCreate any required production credentials`);
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {

        const teamDevOpsProjectId = getDevOpsEnvironmentDetails(this.gluonTeamName).openshiftProjectId;

        const team: QMTeam = await this.gluonService.teams.gluonTeamByName(this.gluonTeamName);

        await this.ocService.setOpenShiftDetails(QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftNonProd);

        const token = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), teamDevOpsProjectId);

        const jenkinsHost: string = await this.ocService.getJenkinsHost(teamDevOpsProjectId);

        logger.debug(`Using Jenkins Route host [${jenkinsHost}] to kick off build`);

        await this.jenkinsDevOpsCredentialsService.createDevOpsJenkinsGlobalCredentials(teamDevOpsProjectId, jenkinsHost, token, team.openShiftCloud, JenkinsCredentialsAction.RECREATE);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_STANDARD_CREDENTIALS);

        const prodCredentials = await this.getProdTokenCredentials(team);

        await this.jenkinsDevOpsCredentialsService.createDevOpsJenkinsGlobalCredentialsFromList(teamDevOpsProjectId, jenkinsHost, token, prodCredentials, JenkinsCredentialsAction.RECREATE);

        await this.taskListMessage.succeedTask(this.TASK_CREATE_PRODUCTION_CREDENTIALS);

        return true;
    }

    private async getProdTokenCredentials(team: QMTeam) {
        const prodTokenCredentials: JenkinsCredentials[] = [];
        for (const prodEnvironment of QMConfig.subatomic.openshiftClouds[team.openShiftCloud].openshiftProd) {
            const prodDevOpsEnvironmentDetails = getDevOpsEnvironmentDetailsProd(team.name);

            await this.ocService.setOpenShiftDetails(prodEnvironment);
            try {
                const prodToken = await this.ocService.getServiceAccountToken(getSubatomicJenkinsServiceAccountName(), prodDevOpsEnvironmentDetails.openshiftProjectId);
                const jenkinsCredentials = getOpenshiftProductionDevOpsJenkinsTokenCredential(team.name, prodEnvironment.name, prodToken);
                prodTokenCredentials.push(jenkinsCredentials);
            } catch {
                logger.warn(`Failed to find the ${prodEnvironment.name} jenkins token. Assuming prod does not exist.`);
            }
        }
        return prodTokenCredentials;
    }
}
