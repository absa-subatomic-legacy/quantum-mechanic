export class QMParamValidationLookup {

    public static getValidationPattern(className: string, paramaterName: string) {
        return QMParamValidationLookup.paramaterValidationMap[className + "_" + paramaterName];
    }

    private static paramaterValidationMap: ParamaterValidationMap = {

        AddConfigServer_gitUri: /^ssh:\/\/.*$/,
        CreateTeam_teamName: /.{1,22}/,
        LinkExistingTeamSlackChannel_newTeamChannel: /^(?!<#).*/,
        OnboardMember_domainUsername: /^[a-z0-9\\\._-]{7,}$/,
        OnboardMember_email: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    };
}

interface ParamaterValidationMap {
    [key: string]: RegExp;
}
