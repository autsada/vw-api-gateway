# Build stage
FROM node:latest AS build

WORKDIR /usr/src/app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npm run build

# Prepare for the final stage - initialize prisma client and install prod dependencies
FROM node:16.17-bullseye-slim AS prisma

RUN apt-get update && apt-get install -y dumb-init libssl-dev ca-certificates
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/prisma ./prisma
RUN npm ci --omit=dev

# Final stage
FROM node:16.17-bullseye-slim

ENV NODE_ENV=production
COPY --from=prisma /usr/bin/dumb-init /usr/bin/dumb-init
WORKDIR /usr/src/app
RUN chown -R node:node /usr/src/app/
USER node
COPY --chown=node:node --from=build /usr/src/app/dist ./
COPY --chown=node:node --from=build /usr/src/app/package*.json ./
COPY --chown=node:node --from=prisma /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=prisma /usr/src/app/node_modules ./node_modules
EXPOSE 8080
CMD ["dumb-init", "node", "src/app.js"]