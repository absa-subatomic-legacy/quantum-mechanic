import {HandleCommand, HandlerContext} from "@atomist/automation-client";
import * as _ from "lodash";
import {QMMember} from "../member/Members";
import {createMenu} from "../shared/GenericMenu";

export function menuForTeams(ctx: HandlerContext, teams: any[],
                             command: HandleCommand, message: string = "Please select a team",
                             projectNameVariable: string = "teamName"): Promise<any> {
    return createMenu(ctx,
        teams.map(team => {
            return {
                value: team.name,
                text: team.name,
            };
        }),
        command,
        message,
        "Select Team",
        projectNameVariable,
    );
}

export function getDevOpsEnvironmentDetails(teamName) {
    return {
        openshiftProjectId: `${_.kebabCase(teamName).toLowerCase()}-devops`,
        name: `${teamName} DevOps`,
        description: `DevOps environment for ${teamName} [managed by Subatomic]`,
    };
}

export function createQMTeam(name: string = null,
                             owners: QMMember[] = [],
                             members: QMMember[] = []): QMTeam {
    return {
        name,
        owners,
        members,
    };
}

export interface QMTeam {
    name: string;
    owners: QMMember[];
    members: QMMember[];
}
