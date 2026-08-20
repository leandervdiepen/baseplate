# Built from the stack/ directory so services can share stack/shared.
FROM node:22-alpine
WORKDIR /app/storage
COPY storage/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY shared /app/shared
COPY storage/src ./src
ENV PORT=3002
EXPOSE 3002
CMD ["npx", "tsx", "src/listen.ts"]
