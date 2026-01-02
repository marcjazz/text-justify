# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack
RUN corepack enable

# Copy configuration files
COPY package.json yarn.lock .yarnrc.yml ./

# Install all dependencies for build
RUN yarn install --immutable

# Copy source code and config
COPY tsconfig.json rollup.config.mjs ./
COPY src ./src

# Build the bundled code
RUN yarn build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Enable Corepack
RUN corepack enable

# Copy package management files for production install
COPY package.json yarn.lock .yarnrc.yml ./

# Install only production dependencies
RUN yarn workspaces focus --all --production

# Copy only the bundled output from the builder
COPY --from=builder /app/dist/server.js ./dist/server.js
COPY --from=builder /app/dist/server.js.map ./dist/server.js.map

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]