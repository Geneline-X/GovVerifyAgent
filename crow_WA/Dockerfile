# Use Debian-based image for maximum Puppeteer/Chromium compatibility
FROM node:18-bullseye-slim

# Set working directory
WORKDIR /usr/src/app

# Install Chromium and required system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libnss3 \
      libx11-6 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libgbm1 \
      libasound2 \
      libatk-bridge2.0-0 \
      libgtk-3-0 \
      xdg-utils \
      curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Explicitly copy the public folder to ensure it's in the image
COPY public/ ./public/

# Verify public folder exists
RUN [ -d ./public ] && echo "✅ Public folder included" || echo "❌ Public folder missing"

# Ensure session/auth directories exist with proper permissions
RUN mkdir -p .wwebjs_auth .wwebjs_cache && \
    chmod 755 .wwebjs_auth .wwebjs_cache

# Run as root (matches docker-compose user: root)

# Expose container port (Render uses PORT env var, default to 3700 for local)
EXPOSE 3700
EXPOSE 10000

# Healthcheck for readiness (use PORT from env or default to 3700)
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3700}/healthz || exit 1

# Set Chromium and Puppeteer environment variables
ENV CHROME_BIN=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_OPTIONS="--max-old-space-size=1024"

# Start the application
CMD ["node", "--expose-gc", "index.js"]
