# Build stage
FROM node:20-alpine AS builder

# Install dependencies for building
RUN apk add --no-cache python3 make g++

# Enable Corepack for Yarn support
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json .yarnrc.yml yarn.lock ./

# Install dependencies
RUN yarn install --immutable

# Copy source code
COPY . .

# Build application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

# Enable Corepack for Yarn support
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json .yarnrc.yml yarn.lock ./

# Install production dependencies only
RUN yarn workspaces focus --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/main"]

# Development stage
FROM node:20-alpine AS development

# Enable Corepack for Yarn support
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json .yarnrc.yml yarn.lock ./

# Install all dependencies (including dev)
RUN yarn install --immutable

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment to development
ENV NODE_ENV=development

# Start in watch mode for hot-reload
CMD ["yarn", "start:dev"]
