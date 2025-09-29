# Use Node.js 18 LTS as base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY scripts ./scripts

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create final runtime image
FROM node:20-alpine

# Set working directory
WORKDIR /opt/wollok-ts-cli

# Copy built application from builder stage
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create symlink for global access
RUN npm link

WORKDIR /work

ENTRYPOINT ["wollok"]

CMD ["test"]
