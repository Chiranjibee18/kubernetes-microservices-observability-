# ==============================================================
# STAGE 1: Build & Dependencies
# ==============================================================
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
# Install production dependencies only
RUN npm ci --only=production

# ==============================================================
# STAGE 2: Hardened Runtime Container
# ==============================================================
FROM node:18-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init to properly handle PID 1 signals (SIGTERM, SIGINT)
RUN apk add --no-cache dumb-init

# Copy dependencies and application source
COPY --from=dependencies /app/node_modules ./node_modules
COPY server.js ./
COPY test.js ./
COPY package*.json ./

# Security Best Practice: Run as non-root user 'node'
USER node

# Expose microservice port
EXPOSE 3000

# Docker-level health check (matches Kubernetes liveness probe)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Launch with dumb-init for clean signal forwarding
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
