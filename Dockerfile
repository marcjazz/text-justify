# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack to use the version of Yarn specified in package.json
RUN corepack enable

# Copy configuration files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Install dependencies (including devDependencies for build)
RUN yarn install --immutable

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript code
RUN yarn tsc

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Enable Corepack
RUN corepack enable

# Copy only the compiled output
COPY --from=builder /app/dist ./dist

# Copy package management files for production install
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Install only production dependencies
RUN yarn install --immutable --production

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]
