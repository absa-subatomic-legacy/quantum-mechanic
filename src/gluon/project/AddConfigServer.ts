import {
    CommandHandler,
    HandlerContext,
    HandlerResult,
    logger,
    MappedParameter,
    MappedParameters,
    Parameter,
    SuccessPromise,
} from "@atomist/automation-client";
import {SlackMessage, url} from "@atomist/slack-messages";
import * as _ from "lodash";
import {QMConfig} from "../../config/QMConfig";
import {NamedSimpleOption} from "../../openshift/base/options/NamedSimpleOption";
import {SimpleOption} from "../../openshift/base/options/SimpleOption";
import {OCClient} from "../../openshift/OCClient";
import {OCCommon} from "../../openshift/OCCommon";
import {logErrorAndReturnSuccess} from "../shared/Error";
import {RecursiveParameter, RecursiveParameterRequestCommand} from "../shared/RecursiveParameterRequestCommand";
import {
    gluonTeamForSlackTeamChannel,
    gluonTeamsWhoSlackScreenNameBelongsTo, menuForTeams,
} from "../team/Teams";

@CommandHandler("Add a new Subatomic Config Server", QMConfig.subatomic.commandPrefix + " add config server")
export class AddConfigServer extends RecursiveParameterRequestCommand {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @MappedParameter(MappedParameters.SlackChannelName)
    public teamChannel: string;

    @Parameter({
        description: "team name",
        displayable: false,
        required: false,
    })
    public gluonTeamName: string;

    @Parameter({
        description: "Remote Git repository URI",
    })
    public gitUri: string;

    protected runCommand(ctx: HandlerContext) {
        return this.addConfigServer(
            ctx,
            this.gluonTeamName,
            this.gitUri,
        );
    }

    protected setNextParameter(ctx: HandlerContext): Promise<HandlerResult> | void {
        if (_.isEmpty(this.gluonTeamName)) {
            return gluonTeamForSlackTeamChannel(this.teamChannel)
                .then(
                    team => {
                        this.gluonTeamName = team.name;
                        return this.setNextParameter(ctx) || null;
                    },
                    () => {
                        return gluonTeamsWhoSlackScreenNameBelongsTo(ctx, this.screenName).then(teams => {
                            return menuForTeams(
                                ctx,
                                teams,
                                this,
                                "Please select a team, whose DevOps project the Subatomic Config Server will be added to",
                                "gluonTeamName",
                            );
                        }).catch(error => {
                            logErrorAndReturnSuccess(gluonTeamsWhoSlackScreenNameBelongsTo.name, error);
                        });
                    },
                );
        }
    }

    private addConfigServer(ctx: HandlerContext,
                            gluonTeamName: string,
                            gitUri: string): Promise<any> {
        const devOpsProjectId = `${_.kebabCase(gluonTeamName).toLowerCase()}-devops`;
        return OCCommon.commonCommand("create secret generic",
            "subatomic-config-server",
            [],
            [
                new NamedSimpleOption("-from-literal=spring.cloud.config.server.git.hostKey", QMConfig.subatomic.bitbucket.cicdKey),
                new NamedSimpleOption("-from-file=spring.cloud.config.server.git.privateKey", QMConfig.subatomic.bitbucket.cicdPrivateKeyPath),
                new SimpleOption("-namespace", devOpsProjectId),
            ])
            .catch(() => {
                logger.warn("Secret subatomic-config-server probably already exists");
                return SuccessPromise;
            })
            .then(() => {
                return OCCommon.createFromData({
                    apiVersion: "v1",
                    kind: "ConfigMap",
                    metadata: {
                        name: "subatomic-config-server",
                    },
                    data: {
                        "application.yml": `
spring:
  cloud:
    config:
      server:
        git:
          ignoreLocalSshSettings: true
          strictHostKeyChecking: false
          hostKeyAlgorithm: ssh-rsa
`,
                    },
                }, [
                    new SimpleOption("-namespace", devOpsProjectId),
                ]);
            })
            .then(() => {
                return OCCommon.commonCommand("tag",
                    "subatomic/subatomic-config-server:1.0",
                    [`${devOpsProjectId}/subatomic-config-server:1.0`],
                );
            })
            .then(() => {
                return OCClient.policy.addRoleToUser(
                    `system:serviceaccount:${devOpsProjectId}:default`,
                    "view",
                    devOpsProjectId);
            })
            .then(() => {
                const saneGitUri = _.replace(gitUri, /(<)|>/g, "");
                return OCCommon.commonCommand("process",
                    "subatomic-config-server-template",
                    [],
                    [
                        new SimpleOption("p", `GIT_URI=${saneGitUri}`),
                        new SimpleOption("p", `IMAGE_STREAM_PROJECT=${devOpsProjectId}`),
                        // TODO relook once we have a designed https://github.com/orgs/absa-subatomic/projects/2#card-7672800
                        new SimpleOption("p", `IMAGE_STREAM_TAG=1.0`),
                        new SimpleOption("-namespace", "subatomic"),
                    ],
                );
            })
            .then(appTemplate => {
                logger.debug(`Processed Subatomic Config Server Template: ${appTemplate.output}`);

                return OCCommon.commonCommand("get", `dc/subatomic-config-server`, [],
                    [
                        new SimpleOption("-namespace", devOpsProjectId),
                    ])
                    .then(() => {
                        logger.warn(`Subatomic Config Server Template has already been processed, deployment exists`);
                        return SuccessPromise;
                    }, () => {
                        return OCCommon.createFromData(JSON.parse(appTemplate.output),
                            [
                                new SimpleOption("-namespace", devOpsProjectId),
                            ]);
                    });
            })
            .then(() => {
                const slackMessage: SlackMessage = {
                    text: `Your Subatomic Config Server has been added to your *${devOpsProjectId}* OpenShift project successfully`,
                    attachments: [{
                        fallback: `Your Subatomic Config Server has been added successfully`,
                        footer: `For more information, please read the ${this.docs()}`,
                    }],
                };

                return ctx.messageClient.addressChannels(slackMessage, this.teamChannel);
            });
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/config-server`,
            "documentation")}`;
    }
}
