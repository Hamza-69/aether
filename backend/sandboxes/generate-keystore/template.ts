import { Template } from 'e2b'

const dockerfileContent = `
  FROM ubuntu:22.04
  
  ENV DEBIAN_FRONTEND=noninteractive
  
  COPY ./generate-keystore.sh /generate-keystore.sh
  
  COPY ./gen-pass.sh /gen-pass.sh
  
  RUN chmod +x /generate-keystore.sh /gen-pass.sh
  
  RUN apt-get update && apt-get install -y \
      openjdk-17-jdk \
      openssl \
      && rm -rf /var/lib/apt/lists/*`;

export const template = Template().fromDockerfile(dockerfileContent)