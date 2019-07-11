export interface QMMemberSlack {
    screenName: string;
    userId: string;
}

export interface QMMemberBase {
    memberId: string;
    firstName: string;
    lastName: string;
    email: string;
    domainUsername: string;
    slack: QMMemberSlack;
}
