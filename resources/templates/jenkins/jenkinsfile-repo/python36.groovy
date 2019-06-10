/**
 * Jenkins pipeline to build an application with the GitHub flow in mind (https://guides.github.com/introduction/flow/).
 *
 * This pipeline requires the following credentials:
 * ---
 * Type          | ID                | Description
 * Secret text   | devops-project    | The OpenShift project Id of the DevOps project that this Jenkins instance is running in
 {{#each devDeploymentEnvironments}}
 * Secret text   | {{toKebabCase postfix}}-project       | The OpenShift project Id of the project's {{displayName}} environment
 {{/each}}
 * Secret text   | docker-registry-ip| The OpenShift docker registry ip
 *
 */
properties([[$class: 'BuildDiscarderProperty', strategy: [$class: 'LogRotator', daysToKeepStr: '10', numToKeepStr: '10']]]);

def deploy(project, app, tag) {
    openshift.withProject(project) {
        def dc = openshift.selector('dc', app);
        for (trigger in dc.object().spec.triggers) {
            if (trigger.type == "ImageChange") {
                def imageStreamName = trigger.imageChangeParams.from.name
                echo "Current ImageStream tag: ${imageStreamName}"
                echo "New ImageStream tag: ${app}:${tag}"
                if (imageStreamName != "${app}:${tag}") {
                    openshift.selector('dc', app).patch("\'{ \"spec\": { \"triggers\": [{ \"type\": \"ImageChange\", \"imageChangeParams\": { \"automatic\": false, \"containerNames\": [\"${app}\"], \"from\": { \"kind\": \"ImageStreamTag\", \"name\": \"${app}:${tag}\" } } }] } }\'")
                }
                def latestVersion = dc.object().status.latestVersion
            }
            openshift.selector('dc', app).rollout().latest()

            timeout(10) {
                def deploymentObject = openshift.selector('dc', "${app}").object()
                if (deploymentObject.spec.replicas > 0) {
                    def latestDeploymentVersion = deploymentObject.status.latestVersion
                    def replicationController = openshift.selector('rc', "${app}-${latestDeploymentVersion}")
                    replicationController.untilEach(1) {
                        def replicationControllerMap = it.object()
                        echo "Replicas: ${replicationControllerMap.status.readyReplicas}"
                        return(replicationControllerMap.spec.replicas.equals(replicationControllerMap.status.readyReplicas))
                    }
                } else {
                    echo "Deployment has a replica count of 0. Not waiting for Pods to become healthy..."
                }
            }
        }
    }
}

def executeInVEnv(String script) {
    sh "source /venv_home/venv/bin/activate && " + script
}

def label = "python36-${UUID.randomUUID().toString()}"

def teamDevOpsProject
def dockerRegistryIp
def sharedResourceNamespace

withCredentials([
        string(credentialsId: 'devops-project', variable: 'DEVOPS_PROJECT_ID'),
        string(credentialsId: 'docker-registry-ip', variable: 'DOCKER_REGISTRY_IP'),
        string(credentialsId: 'sub-shared-resource-namespace', variable: 'SUB_SHARED_RESOURCE_NAMESPACE')
]) {
    teamDevOpsProject = "${env.DEVOPS_PROJECT_ID}"
    dockerRegistryIp = "${env.DOCKER_REGISTRY_IP}"
    sharedResourceNamespace = "${env.SUB_SHARED_RESOURCE_NAMESPACE}"
}

echo "Starting to try find pod template: " + dockerRegistryIp + '/' + sharedResourceNamespace + '/jenkins-slave-python36-subatomic:2.0'

podTemplate(cloud: "openshift", label: label, serviceAccount:"jenkins", containers: [
    containerTemplate(name: 'jnlp', image: dockerRegistryIp + '/' + sharedResourceNamespace + '/jenkins-slave-python36-subatomic:2.0', ttyEnabled: false, alwaysPullImage: true, args: '${computer.jnlpmac} ${computer.name}')
  ])
{
  	echo "Trying to get node " + label
    node(label) {
        {{#each devDeploymentEnvironments}}
        def project{{toPascalCase postfix}}Project
        {{/each}}

        withCredentials([
                {{#each devDeploymentEnvironments}}
                    string(credentialsId: '{{toKebabCase postfix}}-project', variable: '{{toUpperSnakeCase postfix}}_PROJECT_ID'),
                {{/each}}
                string(credentialsId: 'devops-project', variable: 'DEVOPS_PROJECT_ID')
        ]) {
            {{#each devDeploymentEnvironments}}
            project{{toPascalCase postfix}}Project = "${env.{{toUpperSnakeCase postfix}}_PROJECT_ID}"
            {{/each}}
        }

        def project = "${env.JOB_NAME.split('/')[0]}"
        def app = "${env.JOB_NAME.split('/')[1]}"
        def appBuildConfig = "${project}-${app}"

        def tag
        stage('Run python stage') {
            container('jnlp') {
                stage('Run Python Checks and Tests') {
                    final scmVars = checkout(scm)

                    def shortGitCommit = scmVars.GIT_COMMIT[0..6]
                    def verCode = UUID.randomUUID().toString()[0..8]
                    tag = "${verCode}-${shortGitCommit}"
                    // Run any tests or build commands here
                    // executeInVEnv 'python -m pip install pytest && python -m pip install -r requirements.txt'
                    // executeInVEnv 'python -m pytest testing/'
                }
            }
        }
        if (env.BRANCH_NAME == 'master' || !env.BRANCH_NAME) {
            stage('OpenShift Build') {
                openshift.withProject(teamDevOpsProject) {
                    def bc = openshift.selector("bc/${appBuildConfig}")

                    def buildConfig = bc.object()
                    def outputImage = buildConfig.spec.output.to.name
                    echo "Current tag: ${outputImage}"
                    if (outputImage != "${appBuildConfig}:${tag}") {
                        bc.patch("\'{ \"spec\": { \"output\": { \"to\": { \"name\": \"${appBuildConfig}:${tag}\" } } } }\'")
                        def result = "Pending"
                        def build = bc.startBuild()
                        timeout(10) {
                            build.untilEach(1) {
                              return it.object().status.phase == "Running"
                            }
                            build.logs('-f')
                            build.untilEach(1) {
                              result = it.object().status.phase
                              return result == "Complete" || result == "Failed"
                            }
                        }
                        if (result == "Failed"){
                          error("Build failed")
                        }
                    }
                }
            }

            {{#each devDeploymentEnvironments}}
            stage('Deploy to {{displayName}}') {
                sh ': Deploying to {{displayName}}...'

                openshift.withProject(teamDevOpsProject) {
                    openshift.tag("${teamDevOpsProject}/${appBuildConfig}:${tag}", "${project{{toPascalCase postfix}}Project}/${app}:${tag}")
                }

                deploy(project{{toPascalCase postfix}}Project, app, tag);
            }
            {{/each}}
        }
    }
}
