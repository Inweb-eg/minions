# Minions Framework - Docker Image
# ================================
# Multi-stage build supporting both standalone and integrated Ollama setups
#
# Targets:
#   minions-slim       - Main image (uses external Ollama container)
#   minions-dev        - Development with hot reload (uses external Ollama)
#   minions-integrated - Single container with Ollama built-in
#
# Build: docker compose build
# Run:   docker compose up -d

# ========================================
# Stage 1: Slim image (uses external Ollama)
# This is the DEFAULT and RECOMMENDED target
# ========================================
FROM node:20-slim AS minions-slim

RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY foundation/package*.json ./foundation/

RUN npm install --production
RUN cd foundation && npm install --production

COPY . .

RUN mkdir -p /app/data/projects /app/data/decisions /app/.planner /app/.vision

ENV NODE_ENV=production
ENV MINIONS_PORT=2505

EXPOSE 2505

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:2505/api/health || exit 1

CMD ["node", "index.js", "--gru"]


# ========================================
# Stage 2: Development image with full tooling
# Uses external Ollama, adds dev dependencies
# ========================================
FROM minions-slim AS minions-dev

# Install dev dependencies
RUN npm install
RUN cd foundation && npm install

ENV NODE_ENV=development

CMD ["node", "index.js", "--gru"]


# ========================================
# Stage 3: Integrated image with Ollama built-in
# For single-container deployments (larger image, slower startup)
# ========================================
FROM ollama/ollama:latest AS ollama-base

FROM node:20-slim AS minions-integrated

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama CLI
COPY --from=ollama-base /usr/bin/ollama /usr/bin/ollama

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY foundation/package*.json ./foundation/

# Install dependencies
RUN npm install --production
RUN cd foundation && npm install --production

# Copy source code
COPY . .

# Create directories for persistent data
RUN mkdir -p /app/data/projects \
    /app/data/decisions \
    /app/data/models \
    /app/.planner \
    /app/.vision

# Environment variables
ENV NODE_ENV=production
ENV MINIONS_PORT=2505
ENV OLLAMA_HOST=http://localhost:11434
ENV OLLAMA_MODELS_PATH=/app/data/models

# Expose ports
# 2505 - Gru Web Interface
# 11434 - Ollama API
EXPOSE 2505 11434

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting Ollama server..."\n\
ollama serve &\n\
OLLAMA_PID=$!\n\
\n\
# Wait for Ollama to be ready\n\
echo "Waiting for Ollama to be ready..."\n\
for i in {1..30}; do\n\
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then\n\
        echo "Ollama is ready!"\n\
        break\n\
    fi\n\
    sleep 1\n\
done\n\
\n\
# Pull default model if not present\n\
if ! ollama list | grep -q "llama3.2"; then\n\
    echo "Pulling llama3.2 model (this may take a while)..."\n\
    ollama pull llama3.2:3b || echo "Model pull failed, will use Gemini fallback"\n\
fi\n\
\n\
echo "Starting Minions..."\n\
exec node index.js --gru\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:2505/api/health || exit 1

# Run
ENTRYPOINT ["/app/docker-entrypoint.sh"]
