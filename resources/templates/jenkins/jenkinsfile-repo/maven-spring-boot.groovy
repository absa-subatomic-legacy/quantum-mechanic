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
 *
 */
properties([[$class: 'BuildDiscarderProperty', strategy: [$class: 'LogRotator', daysToKeepStr: '10', numToKeepStr: '10']]]);

def deploy(project, app, tag) {
    openshift.withProject(project) {
        def dc = openshift.selector('dc', app);
        def latestVersion = dc.object().status.latestVersion
        for (trigger in dc.object().spec.triggers) {
            if (trigger.type == "ImageChange") {
                def imageStreamName = trigger.imageChangeParams.from.name
                echo "Current ImageStream tag: ${imageStreamName}"
                echo "New ImageStream tag: ${app}:${tag}"
                if (imageStreamName != "${app}:${tag}") {
                    openshift.selector('dc', app).patch("\'{ \"spec\": { \"triggers\": [{ \"type\": \"ImageChange\", \"imageChangeParams\": { \"automatic\": false, \"containerNames\": [\"${app}\"], \"from\": { \"kind\": \"ImageStreamTag\", \"name\": \"${app}:${tag}\" } } }] } }\'")
                }

            }
            echo "Rollout deployment of DC"
            if (latestVersion !='0'){
                openshift.selector('dc', app).rollout().latest()
            }

            timeout(10) {
                def deploymentObject = openshift.selector('dc', "${app}").object()
                if (deploymentObject.spec.replicas > 0) {
                    def latestDeploymentVersion = deploymentObject.status.latestVersion
                    def replicationController = openshift.selector('rc', "${app}-${latestDeploymentVersion}")
                    echo "Waiting for replication controller ${app}-${latestDeploymentVersion} to become ready."
                    replicationController.untilEach(1) {
                        def replicationControllerMap = it.object()
                        echo "Deployment pending."
                        return (replicationControllerMap.status.replicas.equals(replicationControllerMap.status.readyReplicas))
                    }
                    echo "Deployment complete. All replicas are ready."
                } else {
                    echo "Deployment has a replica count of 0. Not waiting for Pods to become healthy..."
                }
            }
        }
    }
}

node('maven') {

    def teamDevOpsProject
    {{#each devDeploymentEnvironments}}
    def project{{toPascalCase postfix}}Project
    {{/each}}

    withCredentials([
            {{#each devDeploymentEnvironments}}
                string(credentialsId: '{{toKebabCase postfix}}-project', variable: '{{toUpperSnakeCase postfix}}_PROJECT_ID'),
            {{/each}}
            string(credentialsId: 'devops-project', variable: 'DEVOPS_PROJECT_ID')
    ]) {
        teamDevOpsProject = "${env.DEVOPS_PROJECT_ID}"
        {{#each devDeploymentEnvironments}}
        project{{toPascalCase postfix}}Project = "${env.{{toUpperSnakeCase postfix}}_PROJECT_ID}"
        {{/each}}
    }

    def project = "${env.JOB_NAME.split('/')[0]}"
    def app = "${env.JOB_NAME.split('/')[1]}"
    def appBuildConfig = "${project}-${app}"

    def tag

    stage('Checks and Tests') {
        final scmVars = checkout(scm)

        def shortGitCommit = scmVars.GIT_COMMIT[0..6]
        def pom = readMavenPom file: 'pom.xml'
        tag = "${pom.version}-${shortGitCommit}"
        echo "Building application ${app}:${tag} from commit ${scmVars} with BuildConfig ${appBuildConfig}"

        try {
            withCredentials([
                    file(credentialsId: 'maven-settings', variable: 'MVN_SETTINGS')
            ]) {
                sh ': Maven build &&' +
                        " mvn --batch-mode test --settings $MVN_SETTINGS" +
                        ' -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn' +
                        ' -Dmaven.test.redirectTestOutputToFile=true'
            }
        } finally {
            junit 'target/surefire-reports/*.xml'
        }

        // TODO split unit and integration tests
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
                }

                def result = "Pending"
                timeout(10) {
                    build.untilEach(1) {
                      return it.object().status.phase == "Running"
                    }
                    build.logs('-f')
                    result = build.object().status.phase
                    echo "Build result: ${result}"
                }
                if (result == "Failed"){
                  error("Build failed")
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
