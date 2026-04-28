# Single Python image used by both the api and ui services.
# The compose file picks the entrypoint per service.

FROM python:3.12-slim

# System deps for psycopg (Postgres driver) and document parsing libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps. The platform/requirements.txt is the source of truth.
COPY platform/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the runtime code. Skills, subagents, AGENTS.md, and deepagents.toml are
# mounted as volumes by compose — NOT baked in — so editing them on the host
# is immediately visible inside the container with no rebuild.
COPY platform/api /app/api

# Default command is overridden per-service in docker-compose.yml.
CMD ["python", "-c", "print('Override CMD via docker-compose service definition.')"]
