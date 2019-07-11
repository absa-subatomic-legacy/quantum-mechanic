import {QMContext} from "../../../context/QMContext";
import {BitbucketConfigurationService} from "../../services/bitbucket/BitbucketConfigurationService";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {userFromDomainUser} from "../../util/member/Members";
import {QMProjectBase} from "../../util/transform/types/gluon/Project";
import {QMTeam} from "../../util/transform/types/gluon/Team";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigureBitbucketProjectRecommendedPractices extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureProjectBitbucket");
    private readonly TASK_ADD_BRANCH_PERMISSIONS = TaskListMessage.createUniqueTaskName("AddBranchPermissions");
    private readonly TASK_ADD_WEB_HOOKS = TaskListMessage.createUniqueTaskName("AddWebHooks");
    private readonly TASK_ADD_DEFAULT_REVIEWERS = TaskListMessage.createUniqueTaskName("AddDefaultReviewers");

    constructor(private team: QMTeam,
                private project: QMProjectBase,
                private bitbucketService: BitbucketService) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_HEADER, `*Configure project ${this.project.name} in Bitbucket for Team ${this.team.name}*`);
        this.taskListMessage.addTask(this.TASK_ADD_BRANCH_PERMISSIONS, "\tSet project branch permissions");
        this.taskListMessage.addTask(this.TASK_ADD_WEB_HOOKS, "\tAdd project commit Web Hooks");
        this.taskListMessage.addTask(this.TASK_ADD_DEFAULT_REVIEWERS, "\tSet project default reviewers");
    }

    protected async executeTask(ctx: QMContext): Promise<boolean> {

        const bitbucketProjectKey = this.project.bitbucketProject.key;

        const bitbucketConfigurationService = new BitbucketConfigurationService(this.bitbucketService);

        const ownerDomainUsernames = this.team.owners.map(owner => userFromDomainUser(owner.domainUsername));
        const memberDomainUsernames = this.team.members.map(member => userFromDomainUser(member.domainUsername));

        await bitbucketConfigurationService.addBranchPermissions(bitbucketProjectKey, ownerDomainUsernames, memberDomainUsernames);

        await this.taskListMessage.succeedTask(this.TASK_ADD_BRANCH_PERMISSIONS);

        await bitbucketConfigurationService.addHooks(bitbucketProjectKey);

        await this.taskListMessage.succeedTask(this.TASK_ADD_WEB_HOOKS);

        await bitbucketConfigurationService.addDefaultReviewers(bitbucketProjectKey, memberDomainUsernames, ownerDomainUsernames);

        await this.taskListMessage.succeedTask(this.TASK_ADD_DEFAULT_REVIEWERS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

}
