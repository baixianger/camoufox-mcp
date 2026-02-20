# Camoufox MCP Server Dockerfile
# Optimized for x86_64 with prebuilt better-sqlite3 binaries
#
# Build: docker build --platform linux/amd64 -t camoufox-mcp .
# Run:   docker run -it --rm camoufox-mcp

FROM node:22-slim

LABEL maintainer="baixianger"
LABEL description="Camoufox MCP Server - Browser automation with anti-detection"

WORKDIR /app

# System dependencies for Camoufox/Firefox
# Using --no-install-recommends to minimize image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Firefox runtime dependencies
    libgtk-3-0 \
    libasound2 \
    libx11-xcb1 \
    libdbus-glib-1-2 \
    libdbus-1-3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxshmfence1 \
    libxfixes3 \
    libxcursor1 \
    libxi6 \
    libgl1 \
    # Virtual framebuffer for headless mode
    xvfb \
    # Fonts for proper text rendering
    fonts-liberation \
    fonts-noto-color-emoji \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./

# Install dependencies
# better-sqlite3 should use prebuilt binaries on node:22-slim/amd64
RUN npm ci --omit=dev

# Install Camoufox browser binary
RUN npx camoufox-js fetch

# Copy built application
COPY dist/ ./dist/
COPY config/ ./config/

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /home/appuser/.cache && \
    cp -r /root/.cache/camoufox /home/appuser/.cache/ 2>/dev/null || true && \
    chown -R appuser:appuser /home/appuser

USER appuser

ENV NODE_ENV=production
ENV HOME=/home/appuser

# MCP server runs on stdio, no port needed
CMD ["node", "dist/index.js"]
