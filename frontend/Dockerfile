FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_GATEWAY_URL=http://localhost:8080
ARG VITE_DEV_TELEMETRY=true

ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL
ENV VITE_DEV_TELEMETRY=$VITE_DEV_TELEMETRY

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /usr/src/app

COPY --from=builder --chown=node:node /usr/src/app/package*.json ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist
COPY --from=builder --chown=node:node /usr/src/app/vite.config.ts ./vite.config.ts

USER node
EXPOSE 3002

CMD ["npm", "run", "preview"]
