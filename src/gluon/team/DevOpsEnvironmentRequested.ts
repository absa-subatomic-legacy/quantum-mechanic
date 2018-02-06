import {
    EventFired,
    EventHandler,
    failure,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    SuccessPromise
} from "@atomist/automation-client";
import {OCClient} from "../../openshift/OCClient";
import {SimpleOption} from "../../openshift/base/options/SimpleOption";
import {OCCommon} from "../../openshift/OCCommon";
import * as _ from "lodash";
import {timeout, TimeoutError} from 'promise-timeout';
import axios from "axios";
import * as https from "https";
import * as qs from "query-string"
import {buttonForCommand} from "@atomist/automation-client/spi/message/MessageClient";
import {CreateProject} from "../project/CreateProject";
import {SlackMessage, url} from "@atomist/slack-messages";

@EventHandler("Receive DevOpsEnvironmentRequestedEvent events", `
subscription DevOpsEnvironmentRequestedEvent {
  DevOpsEnvironmentRequestedEvent {
    id
    team {
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
    requestedBy {
      firstName
      slackIdentity {
        screenName
      }
    }
  }
}
`)
export class DevOpsEnvironmentRequested implements HandleEvent<any> {

    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested DevOpsEnvironmentRequestedEvent event: ${JSON.stringify(event.data)}`);

        const devOpsRequestedEvent = event.data.DevOpsEnvironmentRequestedEvent[0];

        const projectId = `${_.kebabCase(devOpsRequestedEvent.team.name).toLowerCase()}-devops`;
        logger.info(`Working with OpenShift project Id: ${projectId}`);

        return OCClient.newProject(projectId,
            `${devOpsRequestedEvent.team.name} DevOps`,
            `DevOps environment for ${devOpsRequestedEvent.team.name} [managed by Subatomic]`)
            .then(() => {
                return this.addMembershipPermissions(projectId,
                    devOpsRequestedEvent.team);
            }, err => {
                logger.warn(err);
                // TODO what do we do with existing projects?
                // We should probably make sure the name, display name etc. is consistent

                return this.addMembershipPermissions(projectId,
                    devOpsRequestedEvent.team);
            })
            .then(() => {
                // 3. Ensure quotas are set per project
                return OCCommon.createFromData({
                    apiVersion: "v1",
                    kind: "ResourceQuota",
                    metadata: {
                        name: "default-quota",
                    },
                    spec: {
                        hard: {
                            "limits.cpu": "16", // 4 * 4m
                            "limits.memory": "4096Mi", // 4 * 1024Mi
                            pods: "4",
                            replicationcontrollers: "4",
                            services: "4",
                        },
                    }
                }, [
                    new SimpleOption("-namespace", projectId),
                ])
                    .then(() => {
                        return OCCommon.createFromData({
                            apiVersion: "v1",
                            kind: "LimitRange",
                            metadata: {
                                name: "default-limits",
                            },
                            spec: {
                                limits: [{
                                    type: "Container",
                                    max: {
                                        cpu: "4",
                                        memory: "1024Mi",
                                    },
                                    "default": {
                                        cpu: "4",
                                        memory: "512Mi",
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
                    });
            })
            .then(() => {
                return OCCommon.commonCommand("get", "templates",
                    ["jenkins-persistent-subatomic"],
                    [
                        new SimpleOption("-namespace", "openshift"),
                        new SimpleOption("-output", "json")
                    ],
                )
                    .then(template => {
                        const appTemplate: any = JSON.parse(template.output);
                        appTemplate.metadata.namespace = projectId;
                        return OCCommon.createFromData(appTemplate,
                            [
                                new SimpleOption("-namespace", projectId),
                            ]
                            ,)
                    });
            }).then(() => {
                return Promise.all([OCCommon.commonCommand("tag",
                    // TODO Fix: abusing the commonCommand here a bit...
                    "openshift/jenkins-subatomic:2.0",
                    [`${projectId}/jenkins-subatomic:2.0`],
                ), OCCommon.commonCommand("tag",
                    "openshift/jenkins-slave-maven-subatomic:2.0",
                    [`${projectId}/jenkins-slave-maven-subatomic:2.0`],
                ), OCCommon.commonCommand("tag",
                    "openshift/jdk8-maven3-newrelic-subatomic:2.0",
                    [`${projectId}/jdk8-maven3-newrelic-subatomic:2.0`],
                )]);
            })
            .then(() => {
                logger.info("Processing Jenkins Template...");
                return OCCommon.commonCommand("process",
                    "jenkins-persistent-subatomic",
                    [],
                    [
                        new SimpleOption("p", `NAMESPACE=${projectId}`),
                        new SimpleOption("p", `JENKINS_IMAGE_STREAM_TAG=jenkins-subatomic:2.0`),
                        new SimpleOption("p", `BITBUCKET_NAME=ABSA Bitbucket`),
                        new SimpleOption("p", `BITBUCKET_URL=https://bitbucket.core.local`),
                        new SimpleOption("p", `BITBUCKET_CREDENTIALS_ID=${projectId}-bitbucket`),
                        // TODO this should be a property on Team. I.e. teamEmail
                        // If no team email then the address of the createdBy member
                        new SimpleOption("p", `JENKINS_ADMIN_EMAIL=test@absa.co.za`),
                        // TODO the registry Cluster IP we will have to get by introspecting the registry Service
                        new SimpleOption("p", `MAVEN_SLAVE_IMAGE=172.30.1.1:5000/${projectId}/jenkins-slave-maven-subatomic:2.0`),
                        new SimpleOption("-namespace", projectId),
                    ]
                )
                    .then(jenkinsTemplate => {
                        logger.debug(`Processed Jenkins Template: ${jenkinsTemplate.output}`);

                        return OCCommon.commonCommand("get", "dc/jenkins", [],
                            [
                                new SimpleOption("-namespace", projectId),
                            ])
                            .then(() => {
                                logger.warn("Jenkins Template has already been processed, deployment exists");
                                return SuccessPromise;
                            }, () => {
                                return OCCommon.createFromData(JSON.parse(jenkinsTemplate.output),
                                    [
                                        new SimpleOption("-namespace", projectId),
                                    ]);
                            });
                    });
            })
            .then(() => {
                return OCCommon.createFromData({
                    apiVersion: "v1",
                    kind: "ServiceAccount",
                    metadata: {
                        annotations: {
                            "subatomic.bison.co.za/managed": "true",
                            "serviceaccounts.openshift.io/oauth-redirectreference.jenkins": '{"kind":"OAuthRedirectReference", "apiVersion":"v1","reference":{"kind":"Route","name":"jenkins"}}',
                        },
                        name: "subatomic-jenkins"
                    }
                }, [
                    new SimpleOption("-namespace", projectId),
                ],)
                    .then(() => {
                        return OCCommon.createFromData({
                            apiVersion: "rbac.authorization.k8s.io/v1beta1",
                            kind: "RoleBinding",
                            metadata: {
                                annotations: {
                                    "subatomic.bison.co.za/managed": "true"
                                },
                                name: "subatomic-jenkins-edit"
                            },
                            roleRef: {
                                apiGroup: "rbac.authorization.k8s.io",
                                kind: "ClusterRole",
                                name: "admin"
                            },
                            subjects: [{
                                kind: "ServiceAccount",
                                name: "subatomic-jenkins"
                            }]
                        }, [
                            new SimpleOption("-namespace", projectId),
                        ], true)
                    })
                    .then(() => {
                        return OCCommon.commonCommand("serviceaccounts",
                            "get-token",
                            [
                                "subatomic-jenkins"
                            ], [
                                new SimpleOption("-namespace", projectId),
                            ],)
                    })
                    .then(token => {
                        logger.info(`Using Service Account token: ${token.output}`);

                        return timeout(OCCommon.commonCommand(
                            "rollout status",
                            "dc/jenkins",
                            [],
                            [
                                new SimpleOption("-namespace", projectId),
                            ])
                            , 60000) // TODO configurable
                            .then(() => {
                                return OCCommon.commonCommand("annotate route",
                                    "jenkins",
                                    [],
                                    [
                                        new SimpleOption("-overwrite", "haproxy.router.openshift.io/timeout=120s"),
                                        new SimpleOption("-namespace", projectId),
                                    ]);
                            })
                            .then(() => {
                                return OCCommon.commonCommand(
                                    "get",
                                    "route/jenkins",
                                    [],
                                    [
                                        new SimpleOption("-output", "jsonpath={.spec.host}"),
                                        new SimpleOption("-namespace", projectId),
                                    ])
                                    .then(jenkinsHost => {
                                        logger.debug(`Using Jenkins Route host [${jenkinsHost.output}] to add Bitbucket credentials`);

                                        const jenkinsAxios = axios.create({
                                            httpsAgent: new https.Agent({
                                                rejectUnauthorized: false,
                                            })
                                        });

                                        jenkinsAxios.interceptors.request.use((request) => {
                                            if (request.data && (request.headers['Content-Type'].indexOf('application/x-www-form-urlencoded') !== -1)) {
                                                logger.debug(`Stringifying URL encoded data: ${qs.stringify(request.data)}`);
                                                request.data = qs.stringify(request.data)
                                            }
                                            return request
                                        });

                                        const jenkinsCredentials = {
                                            "": "0",
                                            credentials: {
                                                scope: "GLOBAL",
                                                id: `${projectId}-bitbucket`,
                                                // TODO get this from config obviously
                                                username: "donovan",
                                                password: "donovan",
                                                description: `${projectId}-bitbucket`,
                                                $class: "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl"
                                            }
                                        };

                                        return jenkinsAxios.post(`https://${jenkinsHost.output}/credentials/store/system/domain/_/createCredentials`,
                                            {
                                                json: `${JSON.stringify(jenkinsCredentials)}`
                                            },
                                            {
                                                headers: {
                                                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                                                    "Authorization": `Bearer ${token.output}`,
                                                }
                                            });
                                    });
                            })
                            .catch((err) => {
                                if (err instanceof TimeoutError) {
                                    logger.error(`Waiting for dc/jenkins deployment timed out`);
                                }
                            });
                    })
                    .then(() => {
                        return OCCommon.commonCommand("get secrets",
                            "bitbucket-ssh",
                            [],
                            [
                                new SimpleOption("-namespace", projectId),
                            ])
                            .then(() => {
                                logger.warn("Bitbucket SSH secret must already exist");
                                return SuccessPromise;
                            }, () => {
                                return OCCommon.commonCommand("secrets new-sshauth",
                                    "bitbucket-ssh",
                                    [],
                                    [
                                        // TODO use configuration to get the cicd key/Root CA for Bitbucket
                                        new SimpleOption("-ssh-privatekey", "/Users/donovan/dev/absa/core/jenkins-pipeline-test/cicd.key"),
                                        new SimpleOption("-ca-cert", "/Users/donovan/dev/absa/core/bitbucket-server/ca-chain.cert.pem"),
                                        new SimpleOption("-namespace", projectId),
                                    ]);
                            });
                    });
            })
            .then(() => {
                const msg: SlackMessage = {
                    text: `Your DevOps environment has been provisioned successfully`,
                    attachments: [{
                        fallback: `Your DevOps environment has been provisioned successfully`,
                        footer: `For more information, please read the ${this.docs()}`, // TODO use actual icon
                        text: `
If you haven't already, you might want to create a Project for your team to work on.`,
                        mrkdwn_in: ["text"],
                        actions: [
                            buttonForCommand(
                                {text: "Create project"},
                                new CreateProject(),
                                {teamName: devOpsRequestedEvent.team.teamId}),
                        ],
                    }],
                };

                return ctx.messageClient.addressChannels(msg, devOpsRequestedEvent.team.slackIdentity.teamChannel);
            })
            .catch(err => {
                return failure(err)
            });
    }

    private addMembershipPermissions(projectId: string, team: any): Promise<any> {
        return Promise.all(
            team.owners.map(owner => {
                let ownerUsername = /[^\\]*$/.exec(owner.domainUsername)[0];
                logger.info(`Adding role to project [${projectId}] and owner [${owner.domainUsername}]: ${ownerUsername}`);
                return OCClient.policy.addRoleToUser(ownerUsername,
                    "admin",
                    projectId)
            }))
            .then(() => {
                return Promise.all(
                    team.members.map(member => {
                        let memberUsername = /[^\\]*$/.exec(member.domainUsername)[0];
                        logger.info(`Adding role to project [${projectId}] and member [${member.domainUsername}]: ${memberUsername}`);
                        return OCClient.policy.addRoleToUser(memberUsername,
                            "view",
                            projectId)
                    }))
            })
    }

    private docs(): string {
        return `${url("https://subatomic.bison.absa.co.za/docs/devops",
            "documentation")}`;
    }
}
