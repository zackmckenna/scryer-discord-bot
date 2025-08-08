# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create directory for event data
RUN mkdir -p /app/data

# Expose the port (not strictly necessary for Discord bots, but good practice)
EXPOSE 3000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S scryer -u 1001

# Change ownership of app directory to scryer user
RUN chown -R scryer:nodejs /app

# Switch to non-root user
USER scryer

# Start the application
CMD ["node", "index.js"]