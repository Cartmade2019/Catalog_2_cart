FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ghostscript graphicsmagick \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev \
    libjpeg-dev libpng-dev libgif-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN npm remove @shopify/cli

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "docker-start"]