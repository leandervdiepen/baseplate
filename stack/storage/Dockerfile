# Built from the stack/ directory so services can share stack/shared.
FROM node:22-alpine
WORKDIR /app/storage
# The lockfile comes along so that installing the same Baseplate version
# twice builds the same container.
COPY storage/package.json storage/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY shared /app/shared
COPY storage/src ./src
ENV PORT=3002
EXPOSE 3002
CMD ["npx", "tsx", "src/listen.ts"]
