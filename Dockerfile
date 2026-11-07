FROM node:24-bookworm-slim AS build
WORKDIR /app

# Install the monorepo from its single lockfile, including build dependencies.
COPY package.json package-lock.json ./
COPY apps/expo/package.json ./apps/expo/package.json
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/school-core/package.json ./packages/school-core/package.json
RUN npm ci --include=dev

COPY . .
ARG VITE_SITE_URL
ARG VITE_CONVEX_URL
ENV VITE_SITE_URL=${VITE_SITE_URL}
ENV VITE_CONVEX_URL=${VITE_CONVEX_URL}
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Nitro's output contains the Node server, runtime dependencies and public assets.
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
