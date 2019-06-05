import {HandleCommand} from "@atomist/automation-client/lib/HandleCommand";
import {Attachment} from "@atomist/slack-messages";
import {createMenuAttachment} from "./GenericMenu";

export function menuAttachmentForTenants(tenants: QMTenant[],
                                         command: HandleCommand, message: string = "Please select a tenant",
                                         tenantNameVariable: string = "tenantName"): Attachment {
    // Sort the list of tenants but put the Default tenant first.
    const customSortedTenants: QMTenant[] = tenants.filter(tenant => tenant.name.toLowerCase() !== "default").sort((a, b) => (a.name > b.name) ? 1 : -1);
    const defaultTenant: QMTenant = tenants.find(tenant => tenant.name.toLowerCase() === "default");
    customSortedTenants.unshift(defaultTenant);

    return createMenuAttachment(
        customSortedTenants.map(tenant => {
            return {
                value: tenant.name,
                text: tenant.name,
            };
        }),
        command,
        {
            text: message,
            fallback: message,
            selectionMessage: "Select Tenant",
            resultVariableName: tenantNameVariable,
        },
    );
}

export function createQMTenant(name: string): QMTenant {
    return {
        name,
    };
}

export interface QMTenant {
    name: string;
}
