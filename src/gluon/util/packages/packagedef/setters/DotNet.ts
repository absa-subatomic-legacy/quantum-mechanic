import {logger} from "@atomist/automation-client";
import {BitbucketService} from "../../../../services/bitbucket/BitbucketService";
import {EnvironmentVariableCommandTemplate} from "../SetterLoader";

export async function setStartupProject(command: EnvironmentVariableCommandTemplate): Array<{ value: string, text: string }> {
    /*
    Get list of project files: Scrap BB for .sln and get list of projects from there
     */
    const bitbucketService = new BitbucketService();
    const repoResult = bitbucketService.bitbucketRepositoryForSlug("CD", "prime-services-portal");
    repoResult.then(data => {
        logger.info(data);
    });
    const arrayOfProjects = [
        {
            value: "Prime.Api/Prime.Api.csproj",
            text: "Prime.Api/Prime.Api.csproj",
        },
    ];
    arrayOfProjects.push(
        {
            value: "ServiceFabric/ServiceFabric.sfproj",
            text: "ServiceFabric/ServiceFabric.sfproj",
        },
    );
    return arrayOfProjects;
}

export function setRestoreSources(command: EnvironmentVariableCommandTemplate): Array<{ value: string, text: string }> {

    const arrayOfRestoreSources = [
        {
            value: "http://nexus.absa.co.za:8081/repository/cib-digital-build/",
            text: "http://nexus.absa.co.za:8081/repository/cib-digital-build/",
        },
    ];
    arrayOfRestoreSources.push(
        {
            value: "https://api.nuget.org/v3/index.json",
            text: "https://api.nuget.org/v3/index.json",
        },
    );
    return arrayOfRestoreSources;
}
