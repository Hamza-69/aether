import { Template } from 'e2b'

const dockerfileContent = `
FROM ubuntu:22.04

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

# Base tools
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    unzip \
    tar \
    git \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# flyctl
RUN curl -L https://fly.io/install.sh | sh
ENV PATH="/root/.fly/bin:$PATH"

COPY ./deploy.sh /deploy.sh
COPY ./setup-backend.sh /setup-backend.sh
COPY ./setup-frontend.sh /setup-frontend.sh

RUN chmod +x /deploy.sh /setup-backend.sh /setup-frontend.sh  

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
`

export const template = Template().fromDockerfile(dockerfileContent)