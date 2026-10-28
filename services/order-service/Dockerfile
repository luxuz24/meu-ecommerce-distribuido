FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /usr/src/app

COPY --from=builder --chown=node:node /usr/src/app/package*.json ./
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/dist ./dist
COPY --from=builder --chown=node:node /usr/src/app/prisma ./prisma
COPY --from=builder --chown=node:node /usr/src/app/prisma.config.ts ./

USER node
EXPOSE 3004

CMD ["npm", "run", "start"]
