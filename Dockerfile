# ToM Server — imagen para Raspberry Pi 4 (arm64) y otros hosts
# Node 20 LTS. Las dependencias del proyecto son JS puro (no requieren toolchain).
FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

# 1) Dependencias primero, para aprovechar la cache de capas
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Codigo de la app
COPY . .

# Puertos HTTP y HTTPS
EXPOSE 3000 3443

# Healthcheck: el endpoint raiz responde el index
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000),r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
