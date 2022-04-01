FROM ubuntu:16.04
ENV ANDROID_HOME /opt/android-sdk-linux
# ------------------------------------------------------ #
# --- Install required tools --------------------------- #
# ------------------------------------------------------ #

RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-8-jdk wget expect git curl
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y unzip

RUN cd /opt && wget -q https://dl.google.com/android/repository/sdk-tools-linux-3859397.zip -O android-sdk.zip
RUN cd /opt && unzip android-sdk.zip -d ${ANDROID_HOME}
RUN cd /opt && rm -f android-sdk.zip

RUN mkdir /root/.android && echo "count=0" > /root/.android/repositories.cfg

ENV PATH ${PATH}:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${ANDROID_HOME}/platform-tools

# Accept all sdk licenses
# Thanks to http://stackoverflow.com/questions/38096225/automatically-accept-all-sdk-licences
RUN (while sleep 3; do echo "y"; done) | sdkmanager --licenses

# Now install all of the necessary packages
RUN sdkmanager "build-tools;25.0.3" "platforms;android-25" "platform-tools"

# Now install node
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
RUN update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

# Now install all of our global npm requirements
RUN npm install -g cordova typescript

# Now install chromium with xvfb for headless testing
RUN DEBIAN_FRONTEND=noninteractive apt-get update
RUN apt-get install -y xvfb chromium-browser
COPY ./scripts/xvfb_chromium.sh /usr/bin/xvfb-chromium
RUN chmod 755 /usr/bin/xvfb-chromium
RUN mv /usr/bin/chromium-browser /usr/bin/chromium
RUN ln -s /usr/bin/xvfb-chromium /usr/bin/google-chrome
RUN ln -s /usr/bin/xvfb-chromium /usr/bin/chromium-browser

ENV CHROME_BIN /usr/bin/chromium-browser

# Install Gradle
RUN mkdir /opt/gradle
RUN cd /opt && wget -q https://services.gradle.org/distributions/gradle-4.4-bin.zip -O gradle.zip
RUN cd /opt && unzip -d /opt/gradle gradle.zip && rm gradle.zip
ENV GRADLE_HOME /opt/gradle/gradle-4.4
ENV PATH ${PATH}:${GRADLE_HOME}/bin

# Install python and awscli
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y python
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y python-pip
RUN pip install --upgrade pip
RUN pip install awscli

RUN mkdir /opt/workspace
WORKDIR /opt/workspace
