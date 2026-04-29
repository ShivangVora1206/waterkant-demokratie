FROM node:18-bullseye-slim AS base
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend ./

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data
EXPOSE 3001

CMD ["node", "src/index.js"]
