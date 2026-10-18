# FixIt Campus API (Express + Socket.IO + CLIP). Build from the repository root:
#   docker build -f server/Dockerfile -t fixit-api .
FROM node:24-slim AS deps
WORKDIR /app
# npm workspaces: install only the server's production dependencies
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --workspace server --omit=dev \
 && npm cache clean --force

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_DIR=uploads
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server ./server
WORKDIR /app/server
# uploads and the downloaded CLIP model live in volumes (see docker-compose.yml)
RUN mkdir -p uploads .cache/models && chown -R node:node /app/server
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
