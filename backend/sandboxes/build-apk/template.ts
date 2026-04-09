import { Template } from 'e2b'

const dockerfileContent = `
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV ANDROID_HOME=/opt/android
ENV GRADLE_USER_HOME=/root/.gradle
ENV PATH="\${ANDROID_HOME}/cmdline-tools/latest/bin:\${ANDROID_HOME}/platform-tools:\${PATH}"

# System deps
RUN apt-get update && apt-get install -y \\
    openjdk-17-jdk \\
    curl \\
    unzip \\
    git \\
    expect \\
    python3 \\
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
    && apt-get install -y nodejs \\
    && rm -rf /var/lib/apt/lists/*

# Android cmdline-tools
RUN mkdir -p $ANDROID_HOME/cmdline-tools/latest && \\
    curl -o /opt/cmdline-tools.zip \\
    https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip && \\
    unzip /opt/cmdline-tools.zip -d /opt/cmdlinetools && \\
    mv /opt/cmdlinetools/cmdline-tools/* $ANDROID_HOME/cmdline-tools/latest/ && \\
    rm -rf /opt/cmdline-tools.zip /opt/cmdlinetools

# Android SDK packages
RUN yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses && \\
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \\
    "platform-tools" \\
    "platforms;android-36" \\
    "build-tools;36.0.0" \\
    "ndk;27.1.12297006"

COPY ./build-apk.sh /build-apk.sh
RUN chmod +x /build-apk.sh

# Global Gradle config: disable daemon, enable parallel + build cache for all builds
RUN mkdir -p /root/.gradle && printf 'org.gradle.daemon=false\\norg.gradle.parallel=true\\norg.gradle.caching=true\\norg.gradle.jvmargs=-Xmx5g -XX:MaxMetaspaceSize=1024m\\norg.gradle.configureondemand=true\\n' > /root/.gradle/gradle.properties

# LAYER 1: Scaffold dummy React Native project
RUN node -e "const fs = require('fs'); const B = String.fromCharCode(92); const N = String.fromCharCode(10); const Q = String.fromCharCode(34); const text = '#!/usr/bin/expect -f' + N + 'set timeout 300' + N + 'spawn npx -y @react-native-reusables/cli@0.7.1 init -t minimal' + N + 'expect ' + Q + 'What is the name of your project?' + Q + N + 'send ' + Q + 'frontend' + B + 'r' + Q + N + 'expect ' + Q + 'Would you like to install dependencies?' + Q + N + 'send ' + Q + 'y' + B + 'r' + Q + N + 'expect ' + Q + 'Which package manager' + Q + N + 'send ' + Q + B + '033' + B + '[B' + B + '033' + B + '[B' + B + 'r' + Q + N + 'expect ' + Q + 'Git' + Q + N + 'send ' + Q + 'y' + B + 'r' + Q + N + 'expect eof' + N; fs.writeFileSync('/opt/init.exp', text);" && \\
    chmod +x /opt/init.exp && \\
    cd /opt && ./init.exp && \\
    rm -f /opt/init.exp

# LAYER 2: Expo prebuild — generates android/ directory with Gradle wrapper
RUN cd /opt/frontend && \\
    npx expo prebuild --platform android --clean --no-install

# LAYER 3: Download Gradle wrapper distribution (fast, no compilation yet)
RUN cd /opt/frontend/android && \\
    echo "reactNativeArchitectures=arm64-v8a,x86_64" >> gradle.properties && \\
    ./gradlew --no-daemon --quiet help

# LAYER 4: Full dummy build to warm Maven + Gradle dependency cache, then clean up
RUN cd /opt/frontend/android && \\
    ./gradlew dependencies --no-daemon --parallel --build-cache --quiet && \\
    cd /opt && rm -rf frontend
`

export const template = Template().fromDockerfile(dockerfileContent)
