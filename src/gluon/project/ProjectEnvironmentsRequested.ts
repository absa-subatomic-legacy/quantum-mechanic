import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {SlackMessage, url} from "@atomist/slack-messages";
import * as _ from "lodash";
import * as qs from "query-string";
import {QMConfig} from "../../config/QMConfig";
import {SimpleOption} from "../../openshift/base/options/SimpleOption";
import {StandardOption} from "../../openshift/base/options/StandardOption";
import {OCClient} from "../../openshift/OCClient";
import {OCCommon} from "../../openshift/OCCommon";
import {QMTemplate} from "../../template/QMTemplate";
import {jenkinsAxios} from "../jenkins/Jenkins";
import {LinkExistingApplication} from "../packages/CreateApplication";
import {LinkExistingLibrary} from "../packages/CreateLibrary";
import {
    ChannelMessageClient,
    handleQMError,
    QMError,
    QMMessageClient,
} from "../shared/Error";
import {isSuccessCode} from "../shared/Http";
import {TaskListMessage, TaskStatus} from "../shared/TaskListMessage";
import {getProjectDisplayName, getProjectId} from "./Project";

@EventHandler("Receive ProjectEnvironmentsRequestedEvent events", `
subscription ProjectEnvironmentsRequestedEvent {
  ProjectEnvironmentsRequestedEvent {
    id
    project {
      projectId
      name
      description
    }
    teams {
      teamId
      name
      slackIdentity {
        teamChannel
      }
      owners {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
      members {
        firstName
        domainUsername
        slackIdentity {
          screenName
        }
      }
    }
    owningTenant {
      tenantId,
      name,
      description
    }
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class ProjectEnvironmentsRequested implements HandleEvent<any> {

    private qmMessageClient: ChannelMessageClient;
    private taskList: TaskListMessage;

    public async handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested ProjectEnvironmentsRequestedEvent event: ${JSON.stringify(event.data)}`);

        const environmentsRequestedEvent = event.data.ProjectEnvironmentsRequestedEvent[0];

        this.qmMessageClient = this.createMessageClient(ctx, environmentsRequestedEvent.teams);

        this.taskList = this.initialiseTaskList(environmentsRequestedEvent.project.name, this.qmMessageClient);

        try {
            const teamDevOpsProjectId = `${_.kebabCase(environmentsRequestedEvent.teams[0].name).toLowerCase()}-devops`;

            await this.createOpenshiftEnvironments(environmentsRequestedEvent, teamDevOpsProjectId);

            await this.createPodNetwork(environmentsRequestedEvent.teams[0].name, environmentsRequestedEvent.owningTenant.name, environmentsRequestedEvent.project.name);

            await this.taskList.setTaskStatus(`PodNetwork`, TaskStatus.Successful);

            logger.debug(`Using owning team DevOps project: ${teamDevOpsProjectId}`);

            const token = await this.getJenkinsServiceAccountToken(teamDevOpsProjectId);
            const jenkinsHost = await this.getJenkinsHost(teamDevOpsProjectId);

            logger.debug(`Using Jenkins Route host [${jenkinsHost.output}] to add Bitbucket credentials`);

            await this.createJenkinsBuildTemplate(environmentsRequestedEvent, teamDevOpsProjectId, jenkinsHost.output, token.output);

            await this.createJenkinsCredentials(teamDevOpsProjectId, jenkinsHost.output, token.output);

            await this.taskList.setTaskStatus(`ConfigJenkins`, TaskStatus.Successful);

            return await this.sendPackageUsageMessage(ctx, environmentsRequestedEvent.project.name, environmentsRequestedEvent.teams);
        } catch (error) {
            await this.taskList.failRemainingTasks();
            return await handleQMError(this.qmMessageClient, error);
        }
    }

    private createMessageClient(ctx: HandlerContext, teams) {
        const messageClient = new ChannelMessageClient(ctx);
        teams.map(team => {
            messageClient.addDestination(team.slackIdentity.teamChannel);
        });
        return messageClient;
    }

    private initialiseTaskList(projectName: string, messageClient: QMMessageClient) {
        const taskList = new TaskListMessage(`🚀 Provisioning of environment's for project *${projectName}* started:`, messageClient);
        taskList.addTask("devEnvironment", "Create Dev Environment");
        taskList.addTask("sitEnvironment", "Create SIT Environment");
        taskList.addTask("uatEnvironment", "Create UAT Environment");
        taskList.addTask("PodNetwork", "Create project/devops pod network");
        taskList.addTask("ConfigJenkins", "Configure Jenkins");
        return taskList;
    }

    private async createOpenshiftEnvironments(environmentsRequestedEvent, teamDevOpsProjectId: string) {
        const environments = [["dev", "Development"],
            ["sit", "Integration testing"],
            ["uat", "User acceptance"]];

        await OCClient.login(QMConfig.subatomic.openshift.masterUrl, QMConfig.subatomic.openshift.auth.token);

        for (const environment of environments) {
            const projectId = getProjectId(environmentsRequestedEvent.owningTenant.name, environmentsRequestedEvent.project.name, environment[0]);
            logger.info(`Working with OpenShift project Id: ${projectId}`);

            await this.createOpenshiftProject(projectId, environmentsRequestedEvent, environment);
            await this.addEditRoleToJenkinsServiceAccount(teamDevOpsProjectId, projectId);
            await this.taskList.setTaskStatus(`${environment[0]}Environment`, TaskStatus.Successful);
        }
    }

    private async addEditRoleToJenkinsServiceAccount(teamDevOpsProjectId: string, projectId: string) {
        return await OCCommon.commonCommand(
            "policy add-role-to-user",
            "edit",
            [
                `system:serviceaccount:${teamDevOpsProjectId}:jenkins`,
            ], [
                new SimpleOption("-namespace", projectId),
            ]);
    }

    private async getJenkinsHost(teamDevOpsProjectId: string) {
        return await OCCommon.commonCommand(
            "get",
            "route/jenkins",
            [],
            [
                new SimpleOption("-output", "jsonpath={.spec.host}"),
                new SimpleOption("-namespace", teamDevOpsProjectId),
            ]);
    }

    private async getJenkinsServiceAccountToken(teamDevOpsProjectId: string) {
        return await OCCommon.commonCommand("serviceaccounts",
            "get-token",
            [
                "subatomic-jenkins",
            ], [
                new SimpleOption("-namespace", teamDevOpsProjectId),
            ]);
    }

    private async createJenkinsBuildTemplate(environmentsRequestedEvent, teamDevOpsProjectId: string, jenkinsHost: string, token: string) {
        const axios = jenkinsAxios();
        const projectTemplate: QMTemplate = new QMTemplate("resources/templates/openshift/openshift-environment-setup.xml");
        const builtTemplate: string = projectTemplate.build(
            {
                projectName: environmentsRequestedEvent.project.name,
                docsUrl: QMConfig.subatomic.docs.baseUrl,
                teamDevOpsProjectId,
                devProjectId: getProjectId(environmentsRequestedEvent.owningTenant.name, environmentsRequestedEvent.project.name, "dev"),
                sitProjectId: getProjectId(environmentsRequestedEvent.owningTenant.name, environmentsRequestedEvent.project.name, "sit"),
                uatProjectId: getProjectId(environmentsRequestedEvent.owningTenant.name, environmentsRequestedEvent.project.name, "uat"),
            },
        );
        logger.info("Template found and built successfully.");
        const jenkinsCreateItemResult = await axios.post(`https://${jenkinsHost}/createItem?name=${_.kebabCase(environmentsRequestedEvent.project.name).toLowerCase()}`,
            builtTemplate,
            {
                headers: {
                    "Content-Type": "application/xml",
                    "Authorization": `Bearer ${token}`,
                },
            });

        if (!isSuccessCode(jenkinsCreateItemResult.status)) {
            if (jenkinsCreateItemResult && jenkinsCreateItemResult.status === 400) {
                logger.warn(`Folder for [${environmentsRequestedEvent.project.name}] probably already created`);
            } else {
                throw new QMError("Failed to create jenkins build template. Network timeout occurred.");
            }
        }
    }

    private async createOpenshiftProject(projectId: string, environmentsRequestedEvent, environment) {
        try {
            await OCClient.newProject(projectId,
                getProjectDisplayName(environmentsRequestedEvent.owningTenant.name, environmentsRequestedEvent.project.name, environment[0]),
                `${environment[1]} environment for ${environmentsRequestedEvent.project.name} [managed by Subatomic]`);
        } catch (err) {
            logger.warn(err);
        } finally {
            await this.addMembershipPermissions(projectId,
                environmentsRequestedEvent.teams);
        }

        await this.createProjectQuotasAndLimits(projectId);
    }

    private async createProjectQuotasAndLimits(projectId: string) {
        await OCCommon.createFromData({
            apiVersion: "v1",
            kind: "ResourceQuota",
            metadata: {
                name: "default-quota",
            },
            spec: {
                hard: {
                    "limits.cpu": "80", // 20 * 4m
                    "limits.memory": "20480Mi", // 20 * 1024Mi
                    "pods": "20",
                    "replicationcontrollers": "20",
                    "services": "20",
                },
            },
        }, [
            new SimpleOption("-namespace", projectId),
        ]);
        await OCCommon.createFromData({
            apiVersion: "v1",
            kind: "LimitRange",
            metadata: {
                name: "default-limits",
            },
            spec: {
                limits: [{
                    type: "Container",
                    max: {
                        cpu: "8",
                        memory: "4096Mi",
                    },
                    default: {
                        cpu: "4",
                        memory: "1024Mi",
                    },
                    defaultRequest: {
                        cpu: "0",
                        memory: "0Mi",
                    },
                }],
            },
        }, [
            new SimpleOption("-namespace", projectId),
        ]);
    }

    private async addMembershipPermissions(projectId: string, teams: any[]) {
        await teams.map(async team => {
            await team.owners.map(async owner => {
                const ownerUsername = /[^\\]*$/.exec(owner.domainUsername)[0];
                logger.info(`Adding role to project [${projectId}] and owner [${owner.domainUsername}]: ${ownerUsername}`);
                await OCClient.policy.addRoleToUser(ownerUsername,
                    "admin",
                    projectId);
            });
            await team.members.map(async member => {
                const memberUsername = /[^\\]*$/.exec(member.domainUsername)[0];
                logger.info(`Adding role to project [${projectId}] and member [${member.domainUsername}]: ${memberUsername}`);
                await OCClient.policy.addRoleToUser(memberUsername,
                    "view",
                    projectId);
            });
        });
    }

    private async createJenkinsCredentials(teamDevOpsProjectId: string, jenkinsHost: string, token: string) {
        const jenkinsCredentials = {
            "": "0",
            "credentials": {
                scope: "GLOBAL",
                id: `${teamDevOpsProjectId}-bitbucket`,
                username: QMConfig.subatomic.bitbucket.auth.username,
                password: QMConfig.subatomic.bitbucket.auth.password,
                description: `${teamDevOpsProjectId}-bitbucket`,
                $class: "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl",
            },
        };
        const axios = jenkinsAxios();
        axios.interceptors.request.use(request => {
            if (request.data && (request.headers["Content-Type"].indexOf("application/x-www-form-urlencoded") !== -1)) {
                logger.debug(`Stringifying URL encoded data: ${qs.stringify(request.data)}`);
                request.data = qs.stringify(request.data);
            }
            return request;
        });

        const createCredentialsResult = await axios.post(`https://${jenkinsHost}/credentials/store/system/domain/_/createCredentials`,
            {
                json: `${JSON.stringify(jenkinsCredentials)}`,
            },
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "Authorization": `Bearer ${token}`,
                },
            });
        if (!isSuccessCode(createCredentialsResult.status)) {
            throw new QMError("Failed to create Jenkins credentials for project");
        }
    }

    private async createPodNetwork(teamName: string, tenantName: string, projectName: string) {
        const teamDevOpsProjectId = `${_.kebabCase(teamName).toLowerCase()}-devops`;
        const projectIdDev = getProjectId(tenantName, projectName, "dev");
        const projectIdSit = getProjectId(tenantName, projectName, "sit");
        const projectIdUat = getProjectId(tenantName, projectName, "uat");
        return OCCommon.commonCommand(
            "adm pod-network",
            "join-projects",
            [projectIdDev, projectIdSit, projectIdUat],
            [
                new StandardOption("to", `${teamDevOpsProjectId}`),
            ]);
    }

    private async sendPackageUsageMessage(ctx: HandlerContext, projectName: string, teams) {
        const msg: SlackMessage = {
            text: `
Since you have Subatomic project environments ready, you can now add packages.
A package is either an application or a library, click the button below to create an application now.`,
            attachments: [{
                fallback: "Create or link existing package",
                footer: `For more information, please read the ${this.docs()}`,
                color: "#45B254",
                thumb_url: "https://raw.githubusercontent.com/absa-subatomic/subatomic-documentation/gh-pages/images/subatomic-logo-colour.png",
                actions: [
                    buttonForCommand(
                        {text: "Link existing application"},
                        new LinkExistingApplication(),
                        {
                            projectName,
                        }),
                    buttonForCommand(
                        {text: "Link existing library"},
                        new LinkExistingLibrary(),
                        {
                            projectName,
                        }),
                ],
            }],
        };

        return ctx.messageClient.addressChannels(msg,
            teams.map(team =>
                team.slackIdentity.teamChannel));
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/quantum-mechanic/command-reference#link-library`,
            "documentation")}`;
    }
}
