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
                        name: "CreatedBy",
                    },
                },
            ],
        },
        {
            kind: "OBJECT",
            name: "CreatedBy",
            fields: [
                {
                    name: "firstName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "lastName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "email",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "domainUsername",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "slackIdentity",
                    type: {
                        kind: "OBJECT",
                        name: "SlackIdentity",
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
                        name: "RequestedBy",
                    },
                },
            ],
        },
        {
            kind: "OBJECT",
            name: "RequestedBy",
            fields: [
                {
                    name: "firstName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "lastName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "email",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "domainUsername",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "slackIdentity",
                    type: {
                        kind: "OBJECT",
                        name: "SlackIdentity",
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
                        name: "RequestedBy",
                    },
                },
            ],
        },
        {
            kind: "OBJECT",
            name: "RequestedBy",
            fields: [
                {
                    name: "firstName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "lastName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "email",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "domainUsername",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "slackIdentity",
                    type: {
                        kind: "OBJECT",
                        name: "SlackIdentity",
                    },
                },
            ],
        },
    ],
};
