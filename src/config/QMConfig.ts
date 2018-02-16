import * as config from "config";
import {SubAtomicConfig} from "./SubAtomicConfig";

export class QMConfig {

    public static subatomic(): SubAtomicConfig {
        return config.get("subatomic");
    }

    public static teamId(): string {
        return config.get("teamId");
    }

    public static token(): string {
        return config.get("token");
    }
}
