# Quantum Mechanic [![Build Status](https://travis-ci.org/absa-subatomic/quantum-mechanic.svg?branch=master)](https://travis-ci.org/absa-subatomic/quantum-mechanic) [![codecov](https://codecov.io/gh/absa-subatomic/quantum-mechanic/branch/master/graph/badge.svg)](https://codecov.io/gh/absa-subatomic/quantum-mechanic) [![Maintainability](https://api.codeclimate.com/v1/badges/fe42b9266ff703473d1a/maintainability)](https://codeclimate.com/github/absa-subatomic/quantum-mechanic/maintainability)

An Atomist [automation client](https://github.com/atomist/automation-client-ts)
with command and event handlers for integration between various external infrastructure components.

Quantum Mechanic extends on the Atomist Automation Client for Slack. It contains command and event handlers for 
OpenShift and leverages the Gluon project for auditing and context awareness.

Therefore, follow the instructions for [Running the Automation Client](https://github.com/atomist/automation-client-ts#running-the-automation-client)
from the [`automation-client-ts`](https://github.com/atomist/automation-client-ts) GitHub repository to gain a better
understanding of the library.

## Development setup

### 1. Install Node and NPM 

Download and install node - v8.12.0 and npm - v6.4.1 or higher from the [NodeJS](https://nodejs.org/en/) site

### 2. Clone the repo

Use the following command in a terminal to clone the repository to the desired local directory.

`git clone https://github.com/absa-subatomic/quantum-mechanic.git`

### 3. Install the Node dependencies

Navigate to the folder you have cloned and use the following node package manager command to install dependencies

`npm install`

### 4. Local configuration

The Atomist Automation Client configuration is read from the `atomist.config.ts` file, however the Quantum Mechanic 
specific configuration can be added to a `local.json` file.

You will need to create a new `config/local.json` file. This file provides local configuration values over and above
the default configurations. 

>Key value pairs stated in angle brackets, "<" or ">" are explained below and must be changed
to the relevant value for your local environment.

> The `local.json` file is excluded in `.gitignore` and therefore will not be staged by Git.

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
        "sharedResourceNamespace": "subatomic",
        "openshiftNonProd": {
          "name": "nonprod",
          "usernameCase": "<case>",
          "internalDockerRegistryUrl": "172.30.1.1:5000",
          "externalDockerRegistryUrl": "<external docker registry url>",
          "masterUrl": "<minishift ip>",
          "auth": {
            "token": "<subatomic service account token>"
          },
          "defaultEnvironments": [
            {
              "id": "dev",
              "description": "DEV"
            },
            {
              "id": "sit",
              "description": "SIT"
            },
            {
              "id": "uat",
              "description": "UAT"
            }
          ]
        },
        "openshiftProd": [
          {
            "name": "prod-a",
            "usernameCase": "<case>",
            "internalDockerRegistryUrl": "172.30.1.1:5000",
            "externalDockerRegistryUrl": "<external docker registry url>",
            "masterUrl": "<minishift ip>",
            "auth": {
              "token": "<subatomic service account token>"
            },
            "defaultEnvironments": [
              {
                "id": "prod-a",
                "description": "PROD"
              }
            ]
          }
        ]
      }
    },
    "bitbucket": {
      "baseUrl": "https://bitbucket.subatomic.local",
      "restUrl": "https://bitbucket.subatomic.local/rest",
      "caPath": "<local-hadron-collider>/minishift-addons/subatomic/certs/subatomic-ca-chain.pem",
      "auth": {
        "username": "subatomic",
        "password": "subatomic",
        "email": "subatomic@local"
      },
      "sshPort": <bitbucket ssh port>,
      "cicdPrivateKeyPath": "<laboratory>/jenkins/cicd.key",
      "cicdKey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCzuPsKSdUwMVw7qQsNY0DQ0jCD3nAJSYoU7yHTgE2MLsRznNpec2dhjkzrgkWULXZlzFqf7MIJheYoIxHeoJzxrV+3nKT99FyFHSWJiEfk1G7PDRyptXspWRSvkhk8ovijVa7IeoYGLGxfGjF+gwO0dpyr/p8bX7t2+N0X0FZbkU7zjKJ5TrSgJuheVi7r1MO16Zr3k0uyRNDSDKPRt2IDmjRT9y6/ofhvFMn7JrMXkHpRYIJJQ/H2py63qYQatCpi38znBfke5fFoBK4L4/vALbH/Gjqj1J5Uadn8inGyrL0WxohWuhwk/K/bwOSw0LNO8bQ5lAmPgPgJYyA4Plm0onPLp1MZcO/Zj5UjEbmf3w+p2/Th0z6LxA0ytIedTYk8lz35h1yuINd1sp2VmiYS10pqJ1HW/3Mx7McwA8tLsuxKjYmOw4sIsunS+GQPPJbVQrB8ekx2CkD/nwf6fyH+RqtIQ6UBo+9013KwJKOd4qEGkKEN3kBzNoamOvfHvJROX7DQJKRux2/qJXggxJ8F7u0Hj5bSrhYbRNV9T9IfJPGWrJm56V+CbqA0mm7FmSuz2+EeUd3h5R8fxju75gbqFsCLnpuDhhUKxE2PMyRqAAaJ7AZYdXXl8NeNbWEPg/GgyEx4not76ibBDggkEjfYxYSU3689uVMhCv+VN2h6ew== Subatomic CI/CD"
    },
    "nexus": {
      "baseUrl": "https://nexus.subatomic.local"
    },
    "maven": {
      "settingsPath": "<maven settings>/settings.xml"
    },
    "docs": {
      "baseUrl": "http://subatomic.bison.ninja"
    },
    "plugins": {
      "directory": "<plugins directory>"
    }
  },
  "atomistWorkspaceId": "<atomist workspace id>",
  "atomistAPIKey": "<atomist workspace api key>",
  //lifecycyle configuration
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
    "data": {}
  },
  "http": {
    "enabled": true,
    "auth": {
      "basic": {
        "enabled": true,
        "username": "user",
        "password": "password"
      },
      "bearer": {
        "enabled": false
      }
    }
  },
  "cluster": {
    "enabled": false,
    "workers": 1
  },
  "secondarySlackChannels": ["my-slack-channel","yet-another-slack-channel"]
}
```

Replace the relevant values above:

| Value         | Description | Source |
| ------------- | ----------- | ------ |
| `<minishift ip>` | The IP address of your minishift instance | Get the IP with `minishift ip` |
| `<subatomic service account token>` | The OpenShift Service Token used to authenticate | Get the token with `oc sa get-token subatomic -n subatomic` |
| `<local-hadron-collider>` | The directory where [local-hadron-collider](https://github.com/absa-subatomic/local-hadron-collider) has been cloned locally | `git clone https://github.com/absa-subatomic/local-hadron-collider.git` |
| `<laboratory>` | The directory where [laboratory](https://github.com/absa-subatomic/laboratory) has been cloned locally | `git clone https://github.com/absa-subatomic/laboratory.git` |
| `<maven settings>` | Directory containing a Maven `settings.xml` to use for Jenkins builds | Example `settings.xml` included [below](#maven-settings) |
| `<atomist workspace id>` | Atomist workspace ID | Available from app.atomist.com under settings |
| `<atomist workspace api key>` | Atomist ApiKey | See [Atomist documentation](https://docs.atomist.com/developer/prerequisites) |
| `<bitbucket ssh port>` | Bitbucket SSH Port | Set this to the port used for ssh git commands on your Bitbucket instance. The default for Local Hadron Collider should be `30999` |
| `<plugins directory>` | Pluging Directory | Set this to the directory which all available plugin modules will be dropped into |
| `<external docker registry url>`| External Docker Registry Url | Url pointing to a docker registry. This is only passed as a templating parameter when creating jenkinsfiles so can be empty if your jenkinsfiles do not use these urls. |
| `<case>` | Set a username case per cloud | Options are either 'upper' or 'lower' |

Note that the settings should be change appropriately if using different environments for prod or multiple prod environments in the relative parts of the settings file.

### 6. Maven settings

You will need to create a config/settings.xml file. 

> The `setting.xml` file is excluded in `.gitignore` and therefore will not be staged by Git.

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

### 7. Test your config

Next run with:

```console
$ npm run compile start
```

The console will return:
``` console return
...
xxx [m:15071] [info ] Opening WebSocket connection
xxx [m:15071] [info ] WebSocket connection established. Listening for incoming messages
```

## Testing

In order for tests to run you'll need to have a running local hadron collider environment:
https://github.com/absa-subatomic/local-hadron-collider

Once you have the environment setup, replace the token and masterUrl in the config.json
with the one's from openshift.

Next run with:
```console
$ npm run test
```

## Contributing
We have enabled git's pre-push hook which runs both our lint and test script. In order to over-ride simply add the `--no-verify` flag to your push command.

Example:
```
git push --no-verify origin some-branch
```
Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning
No versioning is in place at the time of creating this documentation

## Authors
[Kieran Bristow](https://github.com/kbristow), 
[Kieran Bester](https://github.com/KieranHons),
[Donovan Muller](https://github.com/donovanmuller),
[Andre de Jager](https://github.com/andrejonathan),
[Chris Kieser](https://github.com/chriskieser),
[Bilal Jooma](https://github.com/Buzzglo)

## License
This project is licensed under the Apache License v2.0 - see the LICENSE file for details

<!-- ## Acknowledgements
Hat tips to anyone inspirational.. -->

## Notes for developers

The message override functionality is being implemented on piece meal basis. The mechanism draws a from a JSON file 
stored in
`resources/templates/messages/`

The file should be named per the area followed by MessageOverride.json 
e.g. `ProjectMessagesOverride.json`

The structure of the JSON is as follows:

```json
{
  "messageLable1": {
    "text": "Message substitution text 1"
  },
    "messageLable2": {
      "text": "Message substitution text 2"
    }
}
```
