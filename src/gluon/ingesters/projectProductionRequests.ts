import {Ingester} from "@atomist/automation-client/ingesters";

export const ProjectProductionEnvironmentsRequestedEvent: Ingester = {
    root_type: "ProjectProductionEnvironmentsRequestedEvent",
    types: [
        {
            kind: "OBJECT",
            name: "ProjectProductionEnvironmentsRequestedEvent",
            fields: [
                {
                    name: "projectProdRequestId",
                    type: {
                        kind: "SCALAR",
                        name: "String",
                    },
                },
            ],
        },
    ],
};
