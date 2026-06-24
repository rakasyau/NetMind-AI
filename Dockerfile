# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies like typescript, vite, esbuild)
RUN npm ci

# Copy source code and config files
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server.ts ./

# Build Vite frontend and compile Express server to dist/
RUN npm run build

# Stage 2: Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package config to install runtime dependencies
COPY package*.json ./

# Install production-only dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled assets and server from the builder stage
COPY --from=builder /app/dist ./dist

# Create an empty projects.json with appropriate permissions for node user fallback
RUN touch projects.json && chown node:node projects.json

# Use non-root node user for container execution (security best practice)
USER node

# Expose backend port
EXPOSE 3000

# Healthcheck checking if the backend endpoint resolves successfully
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({ host: 'localhost', port: 3000, path: '/api/health', method: 'GET', timeout: 2000 }, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Command to launch NetMind-AI
CMD ["node", "dist/server.cjs"]
