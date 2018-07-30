import {Ingester} from "@atomist/automation-client/ingesters";

export const TeamCreatedEvent: Ingester = {
    root_type: "TeamCreatedEvent",
    types: [
        {
            kind: "OBJECT",
            name: "TeamCreatedEvent",
            fields: [
                {
                    name: "team",
                    type: {
                        kind: "OBJECT",
                        name: "GluonTeam",
                    },
                },
                {
                    name: "createdBy",
                    type: {
                        kind: "OBJECT",
                        name: "ActionedBy",
                    },
                },
            ],
        },
    ],
};

export const DevOpsEnvironmentRequestedEvent: Ingester = {
    root_type: "DevOpsEnvironmentRequestedEvent",
    types: [
        {
            kind: "OBJECT",
            name: "DevOpsEnvironmentRequestedEvent",
            fields: [
                {
                    name: "team",
                    type: {
                        kind: "OBJECT",
                        name: "GluonTeam",
                    },
                },
                {
                    name: "requestedBy",
                    type: {
                        kind: "OBJECT",
                        name: "ActionedBy",
                    },
                },
            ],
        },
    ],
};

export const DevOpsEnvironmentProvisionedEvent: Ingester = {
    root_type: "DevOpsEnvironmentProvisionedEvent",
    types: [
        {
            kind: "OBJECT",
            name: "DevOpsEnvironmentProvisionedEvent",
            fields: [
                {
                    name: "team",
                    type: {
                        kind: "OBJECT",
                        name: "GluonTeam",
                    },
                },
                {
                    name: "devOpsEnvironment",
                    type: {
                        kind: "OBJECT",
                        name: "DevOpsEnvironmentDetails",
                    },
                },
            ],
        },
    ],
};

export const DevOpsEnvironmentDetails = {
    root_type: "DevOpsEnvironmentDetails",
    types: [
        {
            kind: "OBJECT",
            name: "DevOpsEnvironmentDetails",
            fields: [
                {
                    name: "projectId",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "name",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "description",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
            ],
        },
    ],
};

export const MembershipRequestCreatedEvent: Ingester = {
    root_type: "MembershipRequestCreatedEvent",
    types: [
        {
            kind: "OBJECT",
            name: "MembershipRequestCreatedEvent",
            fields: [
                {
                    name: "membershipRequestId",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "team",
                    type: {
                        kind: "OBJECT",
                        name: "GluonTeam",
                    },
                },
                {
                    name: "requestedBy",
                    type: {
                        kind: "OBJECT",
                        name: "ActionedBy",
                    },
                },
            ],
        },
    ],
};

export const MembersAddedToTeamEvent: Ingester = {
    root_type: "MembersAddedToTeamEvent",
    types: [
        {
            kind: "OBJECT",
            name: "MembersAddedToTeamEvent",
            fields: [
                {
                    name: "team",
                    type: {
                        kind: "OBJECT",
                        name: "GluonTeam",
                    },
                },
                {
                    name: "owners",
                    type: {
                        kind: "LIST",
                        ofType: {
                            kind: "OBJECT",
                            name: "Member",
                        },
                    },
                },
                {
                    name: "members",
                    type: {
                        kind: "LIST",
                        ofType: {
                            kind: "OBJECT",
                            name: "Member",
                        },
                    },
                },
            ],
        },
    ],
};
