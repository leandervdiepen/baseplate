# Built from the stack/ directory so services can share stack/shared.
# pg_dump and pg_restore must match the server's major version, so it is pinned
# here next to the postgres image in compose.yaml.
FROM node:22-alpine
RUN apk add --no-cache postgresql16-client
WORKDIR /app/backup
# The lockfile comes along so that installing the same Baseplate version
# twice builds the same container.
COPY backup/package.json backup/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY shared /app/shared
COPY backup/src ./src
CMD ["npx", "tsx", "src/listen.ts"]
