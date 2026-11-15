# Environment Variables

This document describes the environment variables used by the MotoGP application.

## Backend Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| None | The backend doesn't currently require any specific environment variables for operation | |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| None | Cache TTL (5 min), history start year (2018) and refresh interval (6 h) are constants in `backend/main.py` | |

## Frontend Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| None | The frontend doesn't currently require any specific environment variables for operation | |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE` | Base URL for API requests (default: `/api`) | `http://localhost:8000/api` |
| `VITE_APP_TITLE` | Application title (default: `MotoGP Race Insights`) | `My MotoGP App` |

## Development Environment Setup

To set up your development environment:

1. Create a `.env` file in the project root:
```bash
# Backend cache settings
CACHE_TTL=600
API_TIMEOUT=60

# Frontend API base URL
VITE_API_BASE=http://localhost:8000/api
```

2. For production deployment, set these variables in your deployment environment.

## Docker Environment

When running in Docker containers, the application will use default values unless explicitly configured.