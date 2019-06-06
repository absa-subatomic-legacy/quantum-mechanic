properties([[$class: 'BuildDiscarderProperty', strategy: [$class: 'LogRotator', daysToKeepStr: '10', numToKeepStr: '10']]]);

def copyAndDeploy(imageStreamName, devOpsProjectId, prodProjectId, app) {
    openshift.withProject(devOpsProjectId) {
        openshift.tag("$devOpsProjectId/$imageStreamName", "$prodProjectId/$imageStreamName")
    }
    openshift.withProject(prodProjectId) {

        def dc = openshift.selector('dc', app);
        for (trigger in dc.object().spec.triggers) {
            if (trigger.type == "ImageChange") {
                def oldImageStreamName = trigger.imageChangeParams.from.name
                echo "Current ImageStream tag: ${oldImageStreamName}"
                echo "New ImageStream tag: ${imageStreamName}"
                if (oldImageStreamName != "${imageStreamName}") {
                    openshift.selector('dc', app).patch("\'{ \"spec\": { \"triggers\": [{ \"type\": \"ImageChange\", \"imageChangeParams\": { \"automatic\": false, \"containerNames\": [\"${app}\"], \"from\": { \"kind\": \"ImageStreamTag\", \"name\": \"${imageStreamName}\" } } }] } }\'")
                }
            }
            openshift.selector('dc', app).rollout().latest()

            timeout(5) {
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
}

def app = "{{toKebabCase application.name}}"
def sourceImageName
def devOpsProjectId
def imageStreamName

def project{{toPascalCase sourceEnvironment.postfix}}Project

{{#each deploymentEnvironments}}
def project{{toPascalCase postfix}}Project
{{/each}}

withCredentials([
        {{#each deploymentEnvironments}}
        string(credentialsId: '{{toKebabCase postfix}}-project', variable: '{{toUpperSnakeCase postfix}}_PROJECT_ID'),
        {{/each}}
        {{#each deploymentEnvironments}}
        string(credentialsId: "$DEVOPS_PROJECT_ID-{{toKebabCase clusterName}}", variable: '{{toUpperSnakeCase clusterName}}_TOKEN'),
        {{/each}}
        string(credentialsId: 'devops-project', variable: 'DEVOPS_PROJECT_ID'),
        string(credentialsId: '{{toKebabCase sourceEnvironment.postfix}}-project', variable: '{{toUpperSnakeCase sourceEnvironment.postfix}}_PROJECT_ID')
]) {
    // Add prod deployment details here
}
