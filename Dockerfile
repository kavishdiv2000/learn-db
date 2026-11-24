# SQL Lab web app (Node.js). Built by docker-compose.yml.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
# msnodesqlv8 (Windows authentication) is optional and not needed in Docker: SQL logins are used
RUN npm install --omit=optional --no-audit --no-fund
COPY server.js setup.sql config.json ./
COPY public ./public
ENV HOST=0.0.0.0 PORT=5080
EXPOSE 5080
CMD ["node", "server.js"]
