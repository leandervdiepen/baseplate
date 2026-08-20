# Built from the stack/ directory so services can share stack/shared.
FROM node:22-alpine
WORKDIR /app/auth
COPY auth/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY shared /app/shared
COPY auth/src ./src
ENV PORT=3001
EXPOSE 3001
CMD ["npx", "tsx", "src/listen.ts"]
