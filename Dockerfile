# ==============================================================================
# Production-Ready Multi-Stage Dockerfile for StoneFlow
# Optimized for React Frontend & Node.js Express Server
# Base Image: Lightweight Node.js Alpine
# ==============================================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests for efficient Docker layer caching
COPY package*.json ./

# Install all dependencies (including dev dependencies required for Vite build)
RUN npm ci

# --- Stage 2: Builder ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment to production during build time
ENV NODE_ENV=production

# Build React SPA frontend (dist/assets) and bundle backend server (dist/server.cjs)
RUN npm run build

# Remove devDependencies to keep production bundle lean
RUN npm prune --production

# --- Stage 3: Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

# Install curl for container health check probe
RUN apk add --no-cache curl

# Create data directory and assign ownership to non-root node user
RUN mkdir -p /app/data && chown -R node:node /app

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Copy built application distribution and production dependencies
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node data ./data

# Switch to security-hardened non-root user
USER node

# Expose server HTTP port
EXPOSE 3000

# Container health probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start production application server
CMD ["npm", "start"]
