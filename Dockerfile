FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts

RUN npm ci

COPY ./src ./src
COPY ./eslint.config.js ./eslint.config.js
COPY ./tsconfig.build.json ./tsconfig.build.json
COPY ./tsconfig.json ./tsconfig.json
COPY ./public ./public

RUN npm run build

FROM node:22-alpine

WORKDIR /opt/wollok-ts-cli

COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

RUN npm link

RUN addgroup -g 1001 -S wollok && \
    adduser -S wollok -u 1001 -G wollok

USER wollok

WORKDIR /work

ENTRYPOINT ["wollok"]

CMD ["test"]
