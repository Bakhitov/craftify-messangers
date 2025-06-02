FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# for arm64 support we need to install chromium provided by debian
# npm ERR! The chromium binary is not available for arm64.
# https://github.com/puppeteer/puppeteer/issues/7740

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && \
    apt-get install -y wget gnupg && \
    apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    libgtk2.0-0 libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 && \
    apt-get install -y chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /project

# Copy package files for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Copy source code first
COPY src/ ./src/

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Проверяем, что сборка прошла успешно
RUN ls -la dist && \
    test -f dist/main.js && echo "Main build successful" || (echo "Main build failed" && exit 1)

# Remove devDependencies to reduce image size AFTER build
RUN npm config set ignore-scripts true && \
    pnpm prune --prod && \
    npm config set ignore-scripts false

# Create directories for auth and logs
RUN mkdir -p .wwebjs_auth logs

ENV DOCKER_CONTAINER=true
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["node", "dist/main.js"]

# docker run -it --entr