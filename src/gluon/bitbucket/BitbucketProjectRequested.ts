import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    success,
    SuccessPromise,
} from "@atomist/automation-client";
import {url} from "@atomist/slack-messages";
import axios from "axios";
import * as _ from "lodash";
import * as path from "path";
import {QMConfig} from "../../config/QMConfig";
import {
    bitbucketAxios,
    bitbucketProjectFromKey,
    requestPromiseOptions,
} from "./Bitbucket";
import {BitbucketConfiguration} from "./BitbucketConfiguration";

@EventHandler("Receive BitbucketProjectRequestedEvent events", `
subscription BitbucketProjectRequestedEvent {
  BitbucketProjectRequestedEvent {
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
    bitbucketProjectRequest {
      key
      name
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
export class BitbucketProjectRequested implements HandleEvent<any> {

    private bitbucketProjectId: string;

    private bitbucketProjectUrl: string;

    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
        logger.info(`Ingested BitbucketProjectRequested event: ${JSON.stringify(event.data)}`);

        const bitbucketProjectRequestedEvent = event.data.BitbucketProjectRequestedEvent[0];
        const key: string = bitbucketProjectRequestedEvent.bitbucketProjectRequest.key;
        const name: string = bitbucketProjectRequestedEvent.bitbucketProjectRequest.name;
        const description: string = bitbucketProjectRequestedEvent.bitbucketProjectRequest.description;
        const caFile = path.resolve(__dirname, QMConfig.subatomic.bitbucket.caPath);

        let teamOwners: string[] = [];
        let teamMembers: string[] = [];
        bitbucketProjectRequestedEvent.teams.map(team => {
            teamOwners = _.union(teamOwners, team.owners.map(owner => owner.domainUsername));
            teamMembers = _.union(teamMembers, team.members.map(member => member.domainUsername));
        });

        const bitbucketConfiguration = new BitbucketConfiguration(
            teamOwners,
            teamMembers,
        );

        const options = requestPromiseOptions(`${QMConfig.subatomic.bitbucket.restUrl}/api/1.0/projects`, "POST");
        options.body = {
            key,
            name,
            description,
        };
        const rp = require("request-promise");

        return rp(options)
            .then(project => {
                logger.info(`Created project: ${JSON.stringify(project.body)} -> ${project.body.id} + ${project.body.links.self[0].href}`);
                this.bitbucketProjectId = project.body.id;
                this.bitbucketProjectUrl = project.body.links.self[0].href;

                return bitbucketConfiguration.configureBitbucketProject(key);
            }, error => {
                logger.info(`Error: ${error}`);
                logger.info(`Stringy Error: ${JSON.stringify(error)}`);
                logger.warn(`Error creating project: ${error.statusCode}`);
                if (error.statusCode === 201 || error.statusCode === 409) {
                    bitbucketProjectFromKey(key)
                        .then(bitbucketProject => {
                            this.bitbucketProjectId = bitbucketProject.id;
                            this.bitbucketProjectUrl = bitbucketProject.links.self[0].href;
                        });

                    return bitbucketConfiguration.configureBitbucketProject(key);
                } else {
                    return ctx.messageClient.addressUsers({
                        // TODO make this more descriptive
                        text: `There was an error creating the ${bitbucketProjectRequestedEvent.project.name} Bitbucket project`,
                    }, bitbucketProjectRequestedEvent.requestedBy.slackIdentity.screenName);
                }
            })
            .then(() => {
                return bitbucketAxios().post(`${QMConfig.subatomic.bitbucket.restUrl}/keys/1.0/projects/${key}/ssh`,
                    {
                        key: {
                            text: QMConfig.subatomic.bitbucket.cicdKey,
                        },
                        permission: "PROJECT_READ",
                    });
            })
            .catch(error => {
                logger.info(`Error: ${error}`);
                logger.info(`Stringy Error: ${JSON.stringify(error)}`);
                logger.warn(`Could not add SSH keys to Bitbucket project: [${error.status}-${JSON.stringify(error.data)}]`);
                if (error.status === 409) {
                    // it's ok, it's already done 👍
                    return SuccessPromise;
                }

                return ctx.messageClient.addressUsers({
                    text: `There was an error adding SSH keys for ${bitbucketProjectRequestedEvent.project.name} Bitbucket project`,
                }, bitbucketProjectRequestedEvent.requestedBy.slackIdentity.screenName);
            })
            .then(() => {
                logger.info(`Confirming Bitbucket project: [${this.bitbucketProjectId}-${this.bitbucketProjectUrl}]`);
                return axios.put(`${QMConfig.subatomic.gluon.baseUrl}/projects/${bitbucketProjectRequestedEvent.project.projectId}`,
                    {
                        bitbucketProject: {
                            bitbucketProjectId: this.bitbucketProjectId,
                            url: this.bitbucketProjectUrl,
                        },
                    })
                    .then(success, error => {
                        logger.error(`Could not confirm Bitbucket project: [${error.response.status}-${error.response.data}]`);
                        return ctx.messageClient.addressUsers({
                            text: `There was an error confirming the ${bitbucketProjectRequestedEvent.project.name} Bitbucket project details`,
                        }, bitbucketProjectRequestedEvent.requestedBy.slackIdentity.screenName);
                    });
            });
    }

    private docs(): string {
        return `${url(`${QMConfig.subatomic.docs.baseUrl}/projects#bitbucket`,
            "documentation")}`;
    }
}
