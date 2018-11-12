import {logger} from "@atomist/automation-client";
import {BaseQMCommand} from "../shared/BaseQMCommand";
import {PluginManager} from "./PluginManager";

export function Extensible(command: string) {
    return (target, key, descriptor) => {
        if (target instanceof BaseQMCommand) {
            const originalMethod = descriptor.value;
            descriptor.value = async function() {
                // Note that the "this" reference here is the owning class of the extended function
                const pluginManager: PluginManager = new PluginManager();
                await pluginManager.loadAvailablePlugins();
                try {
                    await pluginManager.preHook(this, command);
                    const result = originalMethod.apply(this, arguments);
                    if (result instanceof Promise) {
                        // this allows for both async and non async functions to be extended
                        await result;
                    }
                    await pluginManager.postHook(this, command);
                    return result;
                } catch (error) {
                    // uncaught errors should be caught and the command should be failed before running post hooks
                    this.failCommand();
                    await pluginManager.postHook(this, command);
                    throw error;
                }
            };
        } else {
            logger.error(`Function marked as Extensible but class does not extend BaseQMCommand. Plugin support disabled for function: ${target.constructor.name}.${key}`);
        }
        return descriptor;
    };
}
