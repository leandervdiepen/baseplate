# Built from the stack/ directory so services can share stack/shared.
FROM node:22-alpine
WORKDIR /app/migrate
# The lockfile comes along so that installing the same Baseplate version
# twice builds the same container.
COPY migrate/package.json migrate/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY shared /app/shared
COPY migrate/src ./src
CMD ["npx", "tsx", "src/main.ts"]
