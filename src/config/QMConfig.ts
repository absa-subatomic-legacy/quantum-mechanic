import * as config from "config";
import {SubAtomicConfig} from "./SubAtomicConfig";

export class QMConfig {

    public static subatomic: SubAtomicConfig = config.get("subatomic");

    public static teamId: string = config.get("teamId");

    public static token: string = config.get("token");

}
