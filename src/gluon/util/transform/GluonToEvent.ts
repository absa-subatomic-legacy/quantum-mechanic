import {QMApplication} from "../../services/gluon/ApplicationService";
import {QMMemberBase} from "../member/Members";
import {QMProject} from "../project/Project";
import {QMTeam, QMTeamBase} from "../team/Teams";
import {ActionedByEvent} from "./types/event/ActionedByEvent";
import {GluonApplicationEvent} from "./types/event/GluonApplicationEvent";
import {KeyValuePairEvent} from "./types/event/KeyValuePairEvent";
import {ProjectEvent} from "./types/event/ProjectEvent";

export class GluonToEvent {

    public static application(gluonApplication: QMApplication): GluonApplicationEvent {
        return {
            applicationId: gluonApplication.applicationId,
            name: gluonApplication.name,
            description: gluonApplication.description,
            applicationType: gluonApplication.applicationType,
        };
    }

    public static project(gluonProject: QMProject): ProjectEvent {
        return {
            projectId: gluonProject.projectId,
            name: gluonProject.name,
            description: gluonProject.description,
        };
    }

    public static bitbucketRepository(gluonApplication: QMApplication) {
        return {
            bitbucketId: gluonApplication.bitbucketRepository.bitbucketId,
            name: gluonApplication.bitbucketRepository.name,
            repoUrl: gluonApplication.bitbucketRepository.repoUrl,
            remoteUrl: gluonApplication.bitbucketRepository.remoteUrl,
            slug: gluonApplication.bitbucketRepository.slug,
        };
    }

    public static bitbucketProject(gluonProject: QMProject) {
        return {
            projectId: gluonProject.bitbucketProject.bitbucketProjectId,
            name: gluonProject.bitbucketProject.name,
            description: gluonProject.bitbucketProject.description,
            url: gluonProject.bitbucketProject.url,
            key: gluonProject.bitbucketProject.key,
        };
    }

    public static teamMinimal(gluonTeam: QMTeamBase) {
        return {
            teamId: gluonTeam.teamId,
            name: gluonTeam.name,
            slackIdentity: gluonTeam.slack,
        };
    }

    public static team(gluonTeamFull: QMTeam) {
        return {
            teamId: gluonTeamFull.teamId,
            name: gluonTeamFull.name,
            slackIdentity: gluonTeamFull.slack,
            owners: gluonTeamFull.owners,
            members: gluonTeamFull.members,
        };
    }

    public static member(gluonMember: QMMemberBase): ActionedByEvent {
        return {
            memberId: gluonMember.memberId,
            firstName: gluonMember.firstName,
            lastName: gluonMember.lastName,
            email: gluonMember.email,
            domainUsername: gluonMember.domainUsername,
            slackIdentity: gluonMember.slack,
        };
    }

    public static keyValueList(keyValueMap: { [key: string]: string }): KeyValuePairEvent[] {
        const keyValueList: KeyValuePairEvent[] = [];
        for (const key of Object.keys(keyValueMap)) {
            keyValueList.push(
                {
                    key,
                    value: keyValueMap[key],
                },
            );
        }
        return keyValueList;
    }
}
