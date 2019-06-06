properties([[$class: 'BuildDiscarderProperty', strategy: [$class: 'LogRotator', daysToKeepStr: '10', numToKeepStr: '10']]]);

def deploy(project, app, tag) {
    openshift.withProject(project) {
        echo "Trying to patch DC ImageStream"
        def dc = openshift.selector('dc', app);
        for (trigger in dc.object().spec.triggers) {
            if (trigger.type == "ImageChange") {
                def dcImageStreamPatch = "\'{ \"spec\": { \"triggers\": [{ \"type\": \"ImageChange\", \"imageChangeParams\": { \"automatic\": false, \"containerNames\": [\"${app}\"], \"from\": { \"kind\": \"ImageStreamTag\", \"name\": \"${app}:${tag}\" } } }] } }\'"
                openshift.selector('dc', app).patch(dcImageStreamPatch)
            }
        }

        echo "Rollout deployment of DC"
        openshift.selector('dc', app).rollout().latest()
        timeout(10) {
            def deploymentObject = openshift.selector('dc', "${app}").object()
            if (deploymentObject.spec.replicas > 0) {
                def latestDeploymentVersion = deploymentObject.status.latestVersion
                def replicationController = openshift.selector('rc', "${app}-${latestDeploymentVersion}")
                replicationController.untilEach(1) {
                    def replicationControllerMap = it.object()
                    echo "Replicas: ${replicationControllerMap.status.readyReplicas}"
                    return (replicationControllerMap.status.replicas.equals(replicationControllerMap.status.readyReplicas))
                }
            } else {
                echo "Deployment has a replica count of 0. Not waiting for Pods to become healthy..."
            }
        }
    }
}

def tagImageStream(sourceProject, destinationProject, imageStreamName, tag) {
    openshift.withProject(sourceProject) {
        openshift.tag("$sourceProject/$imageStreamName:$tag", "$destinationProject/$imageStreamName:$tag")
    }
}

class Tag {
    String tag;
    String date;
}

def getAvailableTags(projectId, imageStreamName){
    def tagDetails = [];
    def tagListStr = "";

    openshift.withProject(projectId) {
        def imageStream = openshift.selector('imagestream', imageStreamName)
        def availableTags = imageStream.object().status.tags
        for (currentTag in availableTags){
            def tag = currentTag.tag;
            def latestDate="0";
            for (tagItem in currentTag.items){
                if (tagItem.created.compareTo(latestDate) > 0){
                    latestDate = tagItem.created;
                }
            }

            def insertIndex = 0;
            for (index = 0; index < tagDetails.size() ; index++) {
                if (latestDate.compareTo(tagDetails[index].date) > 0){
                    break;
                }
                insertIndex = index + 1;
            }
            tagDetails = tagDetails.plus(insertIndex, [new Tag(tag:tag, date:latestDate)]);
        }
    }

    def maxIndex = Math.min(tagDetails.size(), 8);
    for (index = 0; index < maxIndex; index ++){
        tagListStr += "${tagDetails[index].tag}\n"
    }
    return tagListStr;
}

def imageStreamName = "{{toKebabCase application.name}}"

def tagParam = "${params.TAG}"

def project{{toPascalCase sourceEnvironment.postfix}}Project

{{#each deploymentEnvironments}}
def project{{toPascalCase postfix}}Project
{{/each}}

withCredentials([
            {{#each deploymentEnvironments}}
            string(credentialsId: '{{toKebabCase postfix}}-project', variable: '{{toUpperSnakeCase postfix}}_PROJECT_ID'),
            {{/each}}
            string(credentialsId: '{{toKebabCase sourceEnvironment.postfix}}-project', variable: '{{toUpperSnakeCase sourceEnvironment.postfix}}_PROJECT_ID')
]) {
    echo "Getting project credentials"
    project{{toPascalCase sourceEnvironment.postfix}}Project = "${env.{{toUpperSnakeCase sourceEnvironment.postfix}}_PROJECT_ID}"
    {{#each deploymentEnvironments}}
    project{{toPascalCase postfix}}Project = "${env.{{toUpperSnakeCase postfix}}_PROJECT_ID}"
    {{/each}}
    
}


pipeline{
    agent {
        label 'master'
    }
    environment {
        latestTags = getAvailableTags(project{{toPascalCase sourceEnvironment.postfix}}Project, imageStreamName)
    }
    stages{
        stage('Select Tag') {
            steps{
                script {
                    env.TAG = input message: 'Please select the tag you wish to deploy', ok: "Deploy",
                            parameters: [choice(name: 'TAG', choices: latestTags, description: 'Tags are sorted in order of recency')]
                }
            }
        }
        {{#each deploymentEnvironments}}
        stage('Tag Image') {
            steps{
                echo "Tagging image with tag ${TAG}"
                tagImageStream(project{{toPascalCase ../sourceEnvironment.postfix}}Project, project{{toPascalCase postfix}}Project, imageStreamName, TAG)
            }
        }
        stage('Deploy Application') {
            steps{
                echo "Patching DC ImageStream and rolling out a new deployment"
                deploy(project{{toPascalCase postfix}}Project, imageStreamName, TAG)
            }
        }
        {{/each}}
    }
}
