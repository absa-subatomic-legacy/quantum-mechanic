# Quantum Mechanic [![Build Status](https://travis-ci.org/absa-subatomic/quantum-mechanic.svg?branch=master)](https://travis-ci.org/absa-subatomic/quantum-mechanic) [![codecov](https://codecov.io/gh/absa-subatomic/quantum-mechanic/branch/master/graph/badge.svg)](https://codecov.io/gh/absa-subatomic/quantum-mechanic) [![Maintainability](https://api.codeclimate.com/v1/badges/fe42b9266ff703473d1a/maintainability)](https://codeclimate.com/github/absa-subatomic/quantum-mechanic/maintainability)

An Atomist [automation client](https://github.com/atomist/automation-client-ts)
with command and event handlers for integration between various external infrastructure components.

## Development setup

Quantum Mechanic is just an Atomist Automation Client.
Therefore, follow the instructions for [Running the Automation Client](https://github.com/atomist/automation-client-ts#running-the-automation-client)
from the [`automation-client-ts`](https://github.com/atomist/automation-client-ts) GitHub repository.

### Local configuration

Instead of editing the `atomist.config.ts` file for local development, you can create
a new `config/local.json` file. This file can provide local configuration values over and above
the default configurations.

Here is an example `local.json`:

```javascript
{
  "subatomic": {
    "commandPrefix": "sub",
    "gluon": {
      "baseUrl": "http://localhost:8080"
    },
    "openshiftClouds": {
      "ab-cloud": {
        "openshiftNonProd": {
          "name": "nonprod",
          "dockerRepoUrl": "172.30.1.1:5000",
          "masterUrl": "https://192.168.64.11:8443",
          "auth": {
            "token": "xxxIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2yyyWljLXRva2VuLTZmNGdyIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6InN1YmF0b21pYyIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6ImIwZjkzODM4LWRkMGQtMTFlOC1hZmVjLTJlNzY5ZTE4MTcyYSIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpzdWJhdG9taWM6c3ViYXRvbWljIn0.kIVtEaFoN0GL-X-vN1XzvFmJ7JzR9YSTdL77e1jQiGesHsKSAYoSM2G_mBro800vZiriDbpBVBtGXZBD0J68JqpDelHuHqbyIHrveDKSikknLbqDhtnrfLZRCrcG07DjxQ19RyTGFu8tZzRSNXZEBiq5Ip7YIf9HSHLoyQ4avqh3LbOzCpqWilMaV6mLFo4pNdejiwGncf12eQrCEqbHG5dZq54jPv77nfBggcjPrtGxWdCFkyFxlH6R09PEFADMawfDc6_380wg317rfPcUhyJ5tmPpYF8wIGeHcygeDLLa-EnYoUkTuDOvi9aDkuVPhfYgcYTl7fsfdMj3eZJbwQ"
          },
          "defaultEnvironments": [
            {
              "id": "dev",
              "description": "Development"
            },
            {
              "id": "sit",
              "description": "Integration testing"
            },
            {
              "id": "uat",
              "description": "User acceptance"
            }
          ]
        },
        "openshiftProd": [
          {
            "name": "prod-a",
            "dockerRepoUrl": "172.30.1.1:5000",
            "masterUrl": "https://192.168.64.11:8443",
            "auth": {
              "token": "xxxiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5yyyaWMiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlY3JldC5uYW1lIjoic3ViYXRvbWljLXRva2VuLTZmNGdyIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6InN1YmF0b21pYyIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50LnVpZCI6ImIwZjkzODM4LWRkMGQtMTFlOC1hZmVjLTJlNzY5ZTE4MTcyYSIsInN1YiI6InN5c3RlbTpzZXJ2aWNlYWNjb3VudDpzdWJhdG9taWM6c3ViYXRvbWljIn0.kIVtEaFoN0GL-X-vN1XzvFmJ7JzR9YSTdL77e1jQiGesHsKSAYoSM2G_mBro800vZiriDbpBVBtGXZBD0J68JqpDelHuHqbyIHrveDKSikknLbqDhtnrfLZRCrcG07DjxQ19RyTGFu8tZzRSNXZEBiq5Ip7YIf9HSHLoyQ4avqh3LbOzCpqWilMaV6mLFo4pNdejiwGncf12eQrCEqbHG5dZq54jPv77nfBggcjPrtGxWdCFkyFxlH6R09PEFADMawfDc6_380wg317rfPcUhyJ5tmPpYF8wIGeHcygeDLLa-EnYoUkTuDOvi9aDkuVPhfYgcYTl7fsfdMj3eZJbwQ"
            },
            "defaultEnvironments": [
              {
                "id": "prod-a",
                "description": "Production A"
              }
            ]
          }
        ]
      }
    },
    "bitbucket": {
      "baseUrl": "https://bitbucket.subatomic.local",
      "restUrl": "https://bitbucket.subatomic.local/rest",
      "caPath": "/Users/andre/Projects/Subatomic/local-hadron-collider/minishift-addons/subatomic/certs/subatomic.ca.crt",
      "auth": {
        "username": "subatomic",
        "password": "subatomic",
        "email": "subatomic@local"
      },
      "sshPort": 30999,
      "cicdPrivateKeyPath": "/Users/andre/Projects/Subatomic/laboratory/jenkins/cicd.key",
      "cicdKey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCzuPsKSdUwMVw7qQsNY0DQ0jCD3nAJSYyyyiEfk1G7PDRyptXspWRSvkhk8ovijVa7IeoYGLGxfGjF+gwO0dpyr/p8bX7t2+N0X0FZbkU7zjKJ5TrSgJuheVi7r1MO16Zr3k0uyRNDSDKPRt2IDmjRT9y6/ofhvFMn7JrMXkHpRYIJJQ/H2py63qYQatCpi38znBfke5fFoBK4L4/vALbH/Gjqj1J5Uadn8inGyrL0WxohWuhwk/K/bwOSw0LNO8bQ5lAmPgPgJYyA4Plm0onPLp1MZcO/Zj5UjEbmf3w+p2/Th0z6LxA0ytIedTYk8lz35h1yuINd1sp2VmiYS10pqJ1HW/3Mx7McwA8tLsuxKjYmOw4sIsunS+GQPPJbVQrB8ekx2CkD/nwf6fyH+RqtIQ6UBo+9013KwJKOd4qEGkKEN3kBzNoamOvfHvJROX7DQJKRux2/qJXggxJ8F7u0Hj5bSrhYbRNV9T9IfJPGWrJm56V+CbqA0mm7FmSuz2+EeUd3h5R8fxju75gbqFsCLnpuDhhUKxE2PMyRqAAaJ7AZYdXXl8NeNbWEPg/GgyEx4not76ibBDggkEjfYxYSU3689uVMhCv+VN2h6ew== Subatomic CI/CD"
    },
    "nexus": {
      "baseUrl": "https://nexus.subatomic.local"
    },
    "maven": {
      "settingsPath": "/Users/andre/Projects/Subatomic/quantum-mechanic/config/settings.xml"
    },
    "docs": {
      "baseUrl": "http://subatomic.bison.ninja"
    }
  },
  "teamId": "TCZLW7AT0",
  "apiKey": "XXX637B9E211EC3B77yyy3F4C98520XXXX",
  // lifecycle configuration
  "lifecycles": {
    "push": {
      "configuration": {
        "emoji-style": "default",
        "show-statuses-on-push": true,
        "build": {
          "style": "decorator"
        },
        "fingerprints": {
          "about-hint": false,
          "render-unchanged": true,
          "style": "fingerprint-inline"
        }
      }
    },
    "pull_request": {
      "configuration": {
        "emoji-style": "default"
      }
    }
  },
  "fingerprints": {
    "data": {
    }
  },
  "http": {
    "enabled": true,
    "auth": {
      "basic": {
        "enabled": false,
        "username": "user",
        "password": "password"
      },
      "bearer": {
        "enabled": false
      }
    }
  }
,
  "cluster": {
    "enabled": false,
    "workers": 1
  }
}

```

Replace the relevant values above:

| Value         | Description | Source |
| ------------- | ----------- | ------ |
| `<minishift ip`> | The IP address of your minishift instance | Get the IP with `minishift ip` |
| `<subatomic service account token>` | The OpenShift Service Token used to authenticate | Get the token with `oc sa get-token subatomic -n subatomic` |
| `<local-hadron-collider>` | The directory where [local-hadron-collider](https://github.com/absa-subatomic/local-hadron-collider) has been cloned locally | `git clone https://github.com/absa-subatomic/local-hadron-collider.git` |
| `<laboratory>` | The directory where [laboratory](https://github.com/absa-subatomic/laboratory) has been cloned locally | `git clone https://github.com/absa-subatomic/laboratory.git` |
| `<maven settings>` | Directory containing a Maven `settings.xml` to use for Jenkins builds | Example `settings.xml` included [below](#maven-settings) |
| `<team Id>` | Slack team Id where the Atomist will respond to commands | See [Atomist documentation](https://docs.atomist.com/user/#slack-team-id) |
| `<Atomist workspace ApiKey>` | Atomist ApiKey | See [Atomist documentation](https://docs.atomist.com/developer/prerequisites) |
| `<bitbucket ssh port>` | Bitbucket SSH Port | Set this to the port used for ssh git commands on your Bitbucket instance. The default for Local Hadron Collider should be `30999` |
| `<plugins directory>` | Pluging Directory | Set this to the directory which all available plugin modules will be dropped into |

Note that the settings should be change appropriately if using different environments for prod or multiple prod environments in the relative parts of the settings file.

### Maven settings

Below is an example Maven settings file (`settings.xml`) that will be used to build projects in Jenkins:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings>
    <servers>
        <server>
            <id>nexus</id>
            <username>deployment</username>
            <password>deployment123</password>
        </server>
    </servers>
    <mirrors>
        <mirror>
            <id>nexus-repository</id>
            <name>Maven Repository Manager running on https://nexus.subatomic.local</name>
            <url>https://nexus.subatomic.local/content/groups/public/</url>
            <mirrorOf>external:*</mirrorOf>
        </mirror>
    </mirrors>
</settings>
```

> The `local.json` file is excluded in `.gitignore` and therefore will not be staged by Git.

Next run with:

```console
$ npm run compile start
...
xxx [m:15071] [info ] Opening WebSocket connection
xxx [m:15071] [info ] WebSocket connection established. Listening for incoming messages
```

### Testing

In order for tests to run you'll need to have a running local hadron collider environment:
https://github.com/absa-subatomic/local-hadron-collider

Once you have the environment setup, replace the token and masterUrl in the config.json
with the one's from openshift.

Next run with:
```console
$ npm run test
```
