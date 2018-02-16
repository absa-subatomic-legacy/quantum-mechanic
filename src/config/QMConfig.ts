import * as config from "config";

export class QMConfig {

    public static subatomic(): any {
        return config.get("subatomic");
    }

    public static teamId(): string {
        return config.get("teamId");
    }

    public static token(): string {
        return config.get("token");
    }
}
