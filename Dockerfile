FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_CACHE_DIR=/opt/puppeteer-cache

COPY package.json package-lock.json ./
RUN npm ci

RUN CHROME_BIN=$(find /opt/puppeteer-cache -name "chrome" -type f -path "*/chrome-linux64/*" | head -1) && \
    ln -sf "$CHROME_BIN" /usr/bin/google-chrome

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

COPY . .

EXPOSE 10000

CMD ["node", "src/index.js"]
