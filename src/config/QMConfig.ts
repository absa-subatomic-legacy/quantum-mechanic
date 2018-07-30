import fs = require("fs");
import _ = require("lodash");
import {HttpAuth} from "./HttpAuth";
import {SubatomicConfig} from "./SubatomicConfig";

export class QMConfig {

    public static subatomic: SubatomicConfig;

    public static teamId: string;

    public static token: string;

    public static http: HttpAuth;

    public static publicConfig() {
        return new PublicQMConfig();
    }

    public static initialize() {
        const config = JSON.parse(fs.readFileSync("config/local.json").toString());
        QMConfig.subatomic = config.subatomic;
        QMConfig.teamId = config.teamId;
        QMConfig.token = config.token;
        QMConfig.http = config.http;
    }

}

export class PublicQMConfig {

    public subatomic: SubatomicConfig = _.cloneDeep(QMConfig.subatomic);

    public teamId: string = _.cloneDeep(QMConfig.teamId);

    constructor() {
        this.subatomic.bitbucket.auth.email = "";
        this.subatomic.bitbucket.auth.password = "";
        this.subatomic.bitbucket.auth.username = "";
        this.subatomic.bitbucket.cicdKey = "";
        this.subatomic.bitbucket.cicdPrivateKeyPath = "";
        this.subatomic.bitbucket.caPath = "";
        this.subatomic.openshift.auth.token = "";
    }
}

QMConfig.initialize();
