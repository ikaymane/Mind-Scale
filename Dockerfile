# NIRAN — one container: the built site + the Node server (live NASA feed, agent, alerts).
# The data JSON in web/public/data is built beforehand by pipeline/build_web_data.py and copied as is.

FROM node:20-alpine AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000
COPY server/ ./server/
COPY --from=build /app/web/dist ./web/dist
EXPOSE 10000
USER node
CMD ["node", "server/index.mjs"]
