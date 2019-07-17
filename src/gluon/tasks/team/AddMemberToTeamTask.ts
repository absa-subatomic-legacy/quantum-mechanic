import {logger} from "@atomist/automation-client";
import {QMContext} from "../../../context/QMContext";
import {GluonService} from "../../services/gluon/GluonService";
import {AddMemberToTeamService} from "../../services/team/AddMemberToTeamService";
import {MemberRole} from "../../util/member/Members";
import {getTeamSlackChannel} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class AddMemberToTeamTask extends Task {

    private readonly TASK_GATHER_REQUEST_DETAILS = TaskListMessage.createUniqueTaskName("GatherRequestDetails");
    private readonly TASK_ADD_USER_TO_TEAM = TaskListMessage.createUniqueTaskName("AddUserToTeam");

    constructor(private memberToAddSlackUserId: string,
                private actioningMemberSlackUserId: string,
                private teamName: string,
                private memberRole: MemberRole,
                private addMemberToTeamService = new AddMemberToTeamService(),
                private gluonService = new GluonService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_GATHER_REQUEST_DETAILS, "Gather required membership request details");
        taskListMessage.addTask(this.TASK_ADD_USER_TO_TEAM, "Add user to team with role: " + this.memberRole.toString());
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {

        const team = await this.gluonService.teams.getTeamByName(this.teamName);

        const teamChannel = getTeamSlackChannel(team);

        logger.info(`Adding member [${this.memberToAddSlackUserId}] to team: ${this.teamName}`);

        const newMember = await this.addMemberToTeamService.getNewMemberGluonDetails(ctx, this.memberToAddSlackUserId, teamChannel);

        this.addMemberToTeamService.verifyAddMemberRequest(newMember, team, this.memberRole);

        logger.info(`Gluon member found: ${JSON.stringify(newMember)}`);

        const actioningMember = await this.gluonService.members.gluonMemberFromSlackUserId(this.actioningMemberSlackUserId);

        await this.taskListMessage.succeedTask(this.TASK_GATHER_REQUEST_DETAILS);

        await this.addMemberToTeamService.addUserToGluonTeam(newMember.memberId, actioningMember.memberId, team.teamId, this.memberRole);

        await this.taskListMessage.succeedTask(this.TASK_ADD_USER_TO_TEAM);

        return true;
    }

}
