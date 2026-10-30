# =====================================================================
# NCIS DVD-to-Plex Automation Studio Dockerfile
# Multi-stage build: Node.js for Vite React build + Python/HandBrake/MakeMKV runtime
# =====================================================================

# Stage 1: Build Frontend Assets
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /build

COPY package*.json tsconfig*.json vite.config.ts index.html ./
COPY src/ ./src/

# Install dependencies and compile production static bundle
RUN npm ci && npm run build

# Stage 2: Final Production Media Runtime
FROM debian:bookworm-slim

LABEL maintainer="NCIS Digitization Studio"
LABEL description="Automated DVD MakeMKV, HandBrake Decomb, and Plex Pipeline with Optical Drive Pass-Through"

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV HOST=0.0.0.0
ENV OPTICAL_DRIVE=/dev/sr0
ENV SCRATCH_DIR=/scratch
ENV PLEX_DIR=/plex

# Install core runtime packages: Python 3, HandBrakeCLI, optical drive utilities, and MakeMKV build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    handbrake-cli \
    curl \
    wget \
    ca-certificates \
    udev \
    lsscsi \
    sg3-utils \
    libexpat1 \
    libgl1 \
    libssl3 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Install headless MakeMKV command line tool (makemkvcon)
# Using official MakeMKV Linux binaries
RUN set -ex; \
    MAKEMKV_VER="1.17.8"; \
    mkdir -p /tmp/makemkv; \
    cd /tmp/makemkv; \
    wget -q "https://www.makemkv.com/download/makemkv-bin-${MAKEMKV_VER}.tar.gz" || true; \
    if [ -f "makemkv-bin-${MAKEMKV_VER}.tar.gz" ]; then \
        tar -xzf "makemkv-bin-${MAKEMKV_VER}.tar.gz"; \
        cd "makemkv-bin-${MAKEMKV_VER}"; \
        mkdir -p tmp; \
        echo "accepted" > tmp/eula_accepted; \
        make install; \
    fi; \
    cd /; \
    rm -rf /tmp/makemkv

# Create application, scratch, and plex media mount directories
WORKDIR /app
RUN mkdir -p /app/backend /app/dist /scratch /plex /config

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /build/dist /app/dist

# Copy Python backend
COPY backend/ /app/backend/
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Expose Web Studio & API port
EXPOSE 5000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/status || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
