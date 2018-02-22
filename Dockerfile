FROM node:9

MAINTAINER Kieran Bristow <bristowkm@gmail.com>

# Atomist
ENV DUMB_INIT_VERSION=1.2.1

RUN curl -s -L -O https://github.com/Yelp/dumb-init/releases/download/v$DUMB_INIT_VERSION/dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && dpkg -i dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && rm -f dumb-init_${DUMB_INIT_VERSION}_amd64.deb

RUN mkdir -p /opt/app

WORKDIR /opt/app

COPY . .

ENV NPM_CONFIG_LOGLEVEL warn

RUN npm install

ENV SUPPRESS_NO_CONFIG_WARNING true

EXPOSE 2866

# OC Client Tools
ENV OC_VERSION "v3.6.0"
ENV OC_RELEASE "openshift-origin-client-tools-v3.6.0-c4dd4cf-linux-64bit"

ADD https://github.com/openshift/origin/releases/download/$OC_VERSION/$OC_RELEASE.tar.gz /opt/oc/release.tar.gz
RUN tar --strip-components=1 -xzvf  /opt/oc/release.tar.gz -C /opt/oc/ && \
    mv /opt/oc/oc /usr/bin/ && \
    rm -rf /opt/oc

EXPOSE 8001


ENTRYPOINT ["dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=128"]

CMD ["node_modules/@atomist/automation-client/start.client.js"]