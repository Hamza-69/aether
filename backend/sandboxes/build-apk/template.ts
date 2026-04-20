import { Template } from 'e2b'

const dockerfileContent = `
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \\
    curl \\
    ca-certificates \\
    git \\
    jq \\
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
    && apt-get install -y nodejs \\
    && rm -rf /var/lib/apt/lists/*

# eas-cli — world-readable so non-root sandbox users can exec it
RUN npm install -g eas-cli

COPY ./eas-build.sh /eas-build.sh
RUN chmod +x /eas-build.sh
`

export const template = Template().fromDockerfile(dockerfileContent)
