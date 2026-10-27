FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_USER_API_URL=http://localhost:3000
ARG VITE_CATALOG_API_URL=http://localhost:3001
ARG VITE_DEV_TELEMETRY=true

ENV VITE_USER_API_URL=$VITE_USER_API_URL
ENV VITE_CATALOG_API_URL=$VITE_CATALOG_API_URL
ENV VITE_DEV_TELEMETRY=$VITE_DEV_TELEMETRY

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/vite.config.ts ./vite.config.ts

EXPOSE 3002

CMD ["npm", "run", "preview"]
