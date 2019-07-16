import {logger} from "@atomist/automation-client";
import {QMContext} from "../../../context/QMContext";
import {GluonService} from "../../services/gluon/GluonService";
import {RemoveMemberFromTeamService} from "../../services/team/RemoveMemberFromTeamService";
import {MemberRole} from "../../util/member/Members";
import {QMError} from "../../util/shared/Error";
import {isMember, isOwner} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class RemoveMemberFromTeamTask extends Task {

    private readonly TASK_GATHER_REQUEST_DETAILS = TaskListMessage.createUniqueTaskName("GatherRequestDetails");
    private readonly TASK_REMOVE_USER_FROM_TEAM = TaskListMessage.createUniqueTaskName("RemoveUserFromTeam");

    constructor(private memberToRemoveSlackUserId: string,
                private screenName: string,
                private teamName: string,
                private memberRole: MemberRole,
                private removeMemberFromTeamService = new RemoveMemberFromTeamService(),
                private gluonService = new GluonService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_GATHER_REQUEST_DETAILS, "Gather required membership request details");
        taskListMessage.addTask(this.TASK_REMOVE_USER_FROM_TEAM, "Remove user from team with role: " + this.memberRole.toString());
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {
        const team = await this.gluonService.teams.getTeamByName(this.teamName);
        const memberToRemove = await this.removeMemberFromTeamService.getMemberGluonDetails(this.memberToRemoveSlackUserId);
        const actioningMember = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

        if (isOwner(team, actioningMember.memberId)) {
            logger.info("actioningMember identified with memberRole:Owner");
            if (isOwner(team, memberToRemove.memberId)) {
                this.memberRole = MemberRole.owner;
            } else if (isMember(team, memberToRemove.memberId)) {
                this.memberRole = MemberRole.member;
            }
            logger.info(`memberToRemove identified as ${this.memberRole}`);
            this.removeMemberFromTeamService.verifyCanRemoveMemberRequest(memberToRemove, team, this.memberRole);

            await this.taskListMessage.succeedTask(this.TASK_GATHER_REQUEST_DETAILS);
            await this.removeMemberFromTeamService.removeUserFromGluonTeam(memberToRemove.memberId, actioningMember.memberId, team.teamId);
            await this.taskListMessage.succeedTask(this.TASK_REMOVE_USER_FROM_TEAM);
        } else {
            throw new QMError(`${actioningMember.slack.screenName}, you are not an owner of this team and cannot remove a member from this team.`);
        }
        return true;
    }
}
