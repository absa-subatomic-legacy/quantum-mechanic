import {Ingester} from "@atomist/automation-client/ingesters";

export const SlackIdentity: Ingester = {
    root_type: "SlackIdentity",
    types: [
        {
            kind: "OBJECT",
            name: "SlackIdentity",
            fields: [
                {
                    name: "screenName",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "userId",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "teamChannel",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
            ],
        },
    ],
};

export const Project: Ingester = {
    root_type: "Project",
    types: [
        {
            kind: "OBJECT",
            name: "Project",
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

export const BitbucketProject: Ingester = {
    root_type: "BitbucketProject",
    types: [
        {
            kind: "OBJECT",
            name: "BitbucketProject",
            fields: [
                {
                    name: "id",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
                {
                    name: "key",
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
                {
                    name: "url",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
            ],
        },
    ],
};

export const GluonTeam: Ingester = {
    root_type: "GluonTeam",
    types: [
        {
            kind: "OBJECT",
            name: "GluonTeam",
            fields: [
                {
                    name: "teamId",
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
                {
                    name: "slackIdentity",
                    type: {
                        kind: "OBJECT",
                        name: "SlackIdentity",
                    },
                },
                {
                    name: "owners",
                    type: {
                        kind: "LIST",
                        ofType: {
                            kind: "OBJECT",
                            name: "Owner",
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
        {
            kind: "OBJECT",
            name: "Owner",
            fields: [
                {
                    name: "firstName",
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
        {
            kind: "OBJECT",
            name: "Member",
            fields: [
                {
                    name: "firstName",
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

export const ActionedBy: Ingester = {
    root_type: "ActionedBy",
    types: [
        {
            kind: "OBJECT",
            name: "ActionedBy",
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
