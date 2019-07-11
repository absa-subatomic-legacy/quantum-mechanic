import {QMMemberBase} from "./Member";
import {QMMetaData} from "./MetaData";

export interface QMTeamSlack {
    teamChannel: string;
}

export interface QMTeamBase {
    teamId: string;
    name: string;
    openShiftCloud: string;
    description: string;
    slack?: QMTeamSlack;
}

export interface QMTeam extends QMTeamBase {
    owners: QMMemberBase[];
    members: QMMemberBase[];
    metadata: QMMetaData;
}
