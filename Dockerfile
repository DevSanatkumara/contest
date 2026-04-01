FROM node:20-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
COPY contest.jsx ../contest.jsx
RUN node node_modules/vite/bin/vite.js build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
COPY --from=ui-builder /app/ui/dist ./ui/dist
EXPOSE 3001
CMD ["node", "server/server.js"]
