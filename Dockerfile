# Game server only (the client is static files, deploy it to a static host).
FROM node:20-slim
WORKDIR /app
COPY package.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm install --workspace=server --workspace=shared --include-workspace-root=false
COPY shared shared
COPY server server
ENV NODE_ENV=production
EXPOSE 2567
CMD ["npm", "run", "start", "--workspace=server"]
