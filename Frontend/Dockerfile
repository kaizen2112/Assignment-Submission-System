# Next.js 16 production image. Three stages so the shipped layer holds neither the npm cache nor the
# full dependency tree — only the traced subset that `output: "standalone"` emits.
#
# Node 24 matches the version this project is developed against (Next 16 requires >= 20.9).

# --- deps: install once, cached on the lockfile alone ------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

# Next's native SWC/Turbopack binaries are prebuilt per libc. Alpine ships musl, and this shim covers
# the glibc-linked transitive binaries that some toolchain packages still assume.
RUN apk add --no-cache libc6-compat

# Only the manifests, so `npm ci` re-runs when a dependency changes and is reused from cache when
# only application source changed. Copying the whole project here would defeat that.
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile the app -------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the browser bundle by `next build` and frozen there — the
# running container cannot change them afterwards. So the API URL has to arrive as a build argument,
# not as a runtime environment variable. The default matches docker-compose's published API port.
ARG NEXT_PUBLIC_API_URL="http://localhost:5000/api/v1"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# NODE_ENV=production here also strips React's development warnings from the bundle.
ENV NODE_ENV=production
RUN npm run build

# --- runtime: standalone server only ----------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# server.js reads both of these. HOSTNAME is the load-bearing one: the default binds loopback inside
# the container, which the host port mapping cannot reach, so the site would appear dead on :3000.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The standalone bundle carries its own minimal node_modules, so nothing is installed in this stage.
COPY --from=build /app/.next/standalone ./
# Deliberately separate: standalone excludes .next/static, and without it every page loads with no
# CSS or JS. There is no ./public in this project, so it is not copied — a COPY of a missing path
# fails the build rather than being skipped.
COPY --from=build /app/.next/static ./.next/static

# The node image ships a non-root `node` user. Running as it limits the damage a compromised
# dependency can do; the cache directory is pre-created because a read-only /app would break the
# server's first write.
RUN mkdir -p .next/cache && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
