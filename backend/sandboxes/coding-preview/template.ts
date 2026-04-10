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
    expect \
    && rm -rf /var/lib/apt/lists/*

# Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# flyctl
RUN curl -L https://fly.io/install.sh | sh
ENV PATH="/root/.fly/bin:$PATH"

WORKDIR /app

COPY ./deploy.sh /app/deploy.sh
COPY ./setup-backend.sh /app/setup-backend.sh
COPY ./setup-frontend.sh /app/setup-frontend.sh

RUN chmod +x /app/deploy.sh /app/setup-backend.sh /app/setup-frontend.sh  

ENV NODE_ENV=production
ENV PORT=3000
`

export const template = Template().fromDockerfile(dockerfileContent)