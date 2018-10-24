import {HandlerContext} from "@atomist/automation-client";
import {BitbucketConfigurationService} from "../../services/bitbucket/BitbucketConfigurationService";
import {BitbucketService} from "../../services/bitbucket/BitbucketService";
import {QMProject} from "../../util/project/Project";
import {QMTeam} from "../../util/team/Teams";
import {Task} from "../Task";
import {TaskListMessage} from "../TaskListMessage";

export class ConfigureBitbucketForProject extends Task {

    private readonly TASK_HEADER = TaskListMessage.createUniqueTaskName("ConfigureProjectBitbucket");
    private readonly TASK_ADD_SSH_KEYS = TaskListMessage.createUniqueTaskName("AddSSHKeys");
    private readonly TASK_ADD_BITBUCKET_USERS = TaskListMessage.createUniqueTaskName("AddBitbucketUsers");
    private readonly TASK_CONFIGURE_PROJECT_SETTINGS = TaskListMessage.createUniqueTaskName("ConfigureProjectSettings");

    constructor(private team: QMTeam,
                private project: QMProject,
                private bitbucketService: BitbucketService) {
        super();
    }

    protected configureTaskListMessage(taskListMessage: TaskListMessage) {
        this.taskListMessage.addTask(this.TASK_HEADER, `*Configure project in Bitbucket*`);
        this.taskListMessage.addTask(this.TASK_ADD_SSH_KEYS, "\tAdd SSH Keys to Bitbucket Project");
        this.taskListMessage.addTask(this.TASK_ADD_BITBUCKET_USERS, "\tAdd user permissions to Bitbucket Project");
        this.taskListMessage.addTask(this.TASK_CONFIGURE_PROJECT_SETTINGS, "\tConfigure default Bitbucket Project settings");
    }

    protected async executeTask(ctx: HandlerContext): Promise<boolean> {

        const bitbucketProjectKey = this.project.bitbucketProject.key;

        await this.bitbucketService.addBitbucketProjectAccessKeys(bitbucketProjectKey);

        const bitbucketConfigurationService = new BitbucketConfigurationService([], [], this.bitbucketService);

        await this.taskListMessage.succeedTask(this.TASK_ADD_SSH_KEYS);

        await bitbucketConfigurationService.addAllOwnersToProject(bitbucketProjectKey, this.team.owners.map(owner => owner.domainUsername));
        await bitbucketConfigurationService.addAllMembersToProject(bitbucketProjectKey, this.team.members.map(member => member.domainUsername));

        await this.taskListMessage.succeedTask(this.TASK_ADD_BITBUCKET_USERS);

        await bitbucketConfigurationService.configureDefaultProjectSettings(bitbucketProjectKey, this.team.owners.map(owner => owner.domainUsername), this.team.members.map(owner => owner.domainUsername));

        await this.taskListMessage.succeedTask(this.TASK_CONFIGURE_PROJECT_SETTINGS);

        await this.taskListMessage.succeedTask(this.TASK_HEADER);

        return true;
    }

}
