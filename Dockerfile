FROM centos/nodejs-8-centos7

LABEL subatomic-version="2.0"

# Atomist
ENV DUMB_INIT_VERSION=1.2.1

USER root

# Add cert
RUN git config --global http.sslCAInfo /opt/app/config/subatomic-ca-chain.pem

## Install dumb-init
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v$DUMB_INIT_VERSION/dumb-init_${DUMB_INIT_VERSION}_amd64

RUN chmod +x /usr/local/bin/dumb-init

RUN mkdir -p /opt/app

WORKDIR /opt/app

# OC Client Tools
ENV OC_VERSION "v3.7.1"
ENV OC_RELEASE "openshift-origin-client-tools-v3.7.1-ab0f056-linux-64bit"

RUN mkdir -p /opt/oc && wget -O /opt/oc/release.tar.gz https://github.com/openshift/origin/releases/download/$OC_VERSION/$OC_RELEASE.tar.gz

RUN tar --strip-components=1 -xzvf  /opt/oc/release.tar.gz -C /opt/oc/ && \
    mv /opt/oc/oc /usr/bin/ && \
    rm -rf /opt/oc

## Need to add node and npm to the path
ENV PATH="/opt/rh/rh-nodejs8/root/usr/bin:${PATH}"

ENV NPM_CONFIG_LOGLEVEL warn

COPY ./package.json .

RUN npm install

COPY . .

ENV SUPPRESS_NO_CONFIG_WARNING true

EXPOSE 2866

USER 1001

ENTRYPOINT ["dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=128"]

CMD ["node_modules/@atomist/automation-client/start.client.js"]