import {HandlerContext, logger} from "@atomist/automation-client";
import * as _ from "lodash";
import {AddMemberToTeamMessages} from "../../messages/team/AddMemberToTeamMessages";
import {GluonService} from "../../services/gluon/GluonService";
import {AddMemberToTeamService} from "../../services/team/AddMemberToTeamService";
import {
    getScreenName,
    loadScreenNameByUserId,
    MemberRole,
} from "../../util/member/Members";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class AddMemberToTeamTask extends Task {

    private addMemberToTeamMessages = new AddMemberToTeamMessages();

    private readonly TASK_GATHER_REQUEST_DETAILS = TaskListMessage.createUniqueTaskName("GatherRequestDetails");
    private readonly TASK_ADD_USER_TO_TEAM = TaskListMessage.createUniqueTaskName("AddUserToTeam");

    constructor(private slackName: string,
                private teamChannel: string,
                private screenName: string,
                private memberRole: MemberRole,
                private addMemberToTeamService = new AddMemberToTeamService(),
                private gluonService = new GluonService()) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        taskListMessage.addTask(this.TASK_GATHER_REQUEST_DETAILS, "Gather required membership request details");
        taskListMessage.addTask(this.TASK_ADD_USER_TO_TEAM, "Add user to team with role: " + this.memberRole.toString());
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {

        logger.info(`Adding member [${this.slackName}] to team: ${this.teamChannel}`);

        const screenName = getScreenName(this.slackName);

        const chatId = await loadScreenNameByUserId(ctx, screenName);

        logger.info(`Got ChatId: ${chatId}`);

        const newMember = await this.addMemberToTeamService.getNewMember(ctx, chatId, this.teamChannel);

        logger.info(`Gluon member found: ${JSON.stringify(newMember)}`);

        logger.info(`Getting teams that ${this.screenName} (you) are a part of...`);

        const actioningMember = await this.gluonService.members.gluonMemberFromScreenName(this.screenName);

        logger.info(`Got member's teams you belong to: ${JSON.stringify(actioningMember)}`);

        const teamSlackChannel = _.find(actioningMember.teams,
            (team: any) => team.slack.teamChannel === this.teamChannel);

        await this.taskListMessage.succeedTask(this.TASK_GATHER_REQUEST_DETAILS);

        if (!_.isEmpty(teamSlackChannel)) {
            await this.addMemberToTeamService.addUserToGluonTeam(newMember.memberId, actioningMember.memberId, teamSlackChannel._links.self.href, this.memberRole);
            await this.taskListMessage.succeedTask(this.TASK_ADD_USER_TO_TEAM);
        } else {
            await ctx.messageClient.respond(this.addMemberToTeamMessages.alertTeamDoesNotExist(this.teamChannel));
            return false;
        }
        return true;
    }

}
