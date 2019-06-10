/**
 * Jenkins pipeline to build an application with the GitHub flow in mind (https://guides.github.com/introduction/flow/).
 *
 */
properties([[$class: 'BuildDiscarderProperty', strategy: [$class: 'LogRotator', daysToKeepStr: '10', numToKeepStr: '10']]]);

node('maven') {
    def project = "${env.JOB_NAME.split('/')[0]}"
    def app = "${env.JOB_NAME.split('/')[1]}"

    def tag

    stage('Checks and Tests') {
        final scmVars = checkout(scm)

        def shortGitCommit = scmVars.GIT_COMMIT[0..6]
        def pom = readMavenPom file: 'pom.xml'
        tag = "${pom.version}-${shortGitCommit}"
        echo "Building application ${app}:${tag} from commit ${scmVars}"

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
    }
}
