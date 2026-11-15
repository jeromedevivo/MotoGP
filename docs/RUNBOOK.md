# MotoGP Project Runbook

This runbook provides operational procedures for the MotoGP project.

## Overview

The MotoGP project is a web application that provides information about MotoGP races, standings, riders, and predictions. It consists of:
- A React/TypeScript frontend with Tailwind CSS
- A FastAPI Python backend that proxies requests to the official MotoGP API

## Deployment Procedures

### Prerequisites

- Docker installed (for containerized deployment)
- Node.js and Python environments for development
- Access to a server or cloud platform

### Local Development Setup

1. **Frontend**:
   ```sh
   npm install
   npm run dev
   ```

2. **Backend**:
   ```sh
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

3. The frontend will be available at `http://localhost:8080`
4. The backend API will be available at `http://localhost:8000`

### Production Deployment

#### Containerized Deployment (Recommended)

1. Build the backend container:
   ```sh
   cd backend
   docker build -t motogp-backend .
   ```

2. Run the backend container:
   ```sh
   docker run -p 8000:8000 motogp-backend
   ```

3. Build and run the frontend:
   ```sh
   npm run build
   # Serve the built files with any HTTP server (nginx, Apache, etc.)
   ```

#### Manual Deployment

1. Install dependencies:
   ```sh
   cd backend
   pip install -r requirements.txt
   npm install
   ```

2. Start backend service:
   ```sh
   python main.py
   ```

3. Build frontend:
   ```sh
   npm run build
   ```

## Historical Dataset

Rankings, circuit sheets and predictions read a dataset of every classified result since 2018
(MotoGP, Moto2, Moto3), stored in `backend/data/history.json.gz` (not versioned).

- **First start**: the backend builds it in the background, about 10–12 minutes. The official API
  rate-limits bursts (HTTP 429), so requests are paced (4 in parallel, one every 0.25 s) and retried.
  Insight endpoints answer `503` until it is ready; the frontend shows a waiting message.
- **Refresh**: incremental every 6 hours (only new finished events), or `POST /api/insights/refresh`.
- **Calibration**: after each build the prediction sharpness is refitted on past races and cached in
  `backend/data/model.json`.
- **Reset**: stop the backend, delete `backend/data/`, restart.

## Health Checks

### Backend Health Endpoint

The backend exposes a health check endpoint at:
```
GET /health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

### Frontend Availability

The frontend should respond to requests on port 8080 with the main application page.

## Monitoring

### Backend Metrics

- API response times
- Cache hit rates
- Error counts
- Request volume per endpoint

### Frontend Metrics

- Page load times
- JavaScript error rates
- User interaction tracking

## Common Issues and Fixes

### 1. API Connection Issues

**Problem**: Backend cannot connect to MotoGP API
**Solution**: 
- Check network connectivity
- Verify MotoGP API is accessible
- Review firewall settings

### 2. CORS Errors

**Problem**: Frontend requests blocked by CORS policy
**Solution**:
- Ensure backend CORS middleware is properly configured
- Verify proxy settings in Vite config

### 3. MotoGP API Rate Limiting (HTTP 429)

**Problem**: Logs show `429 Too Many Requests` during a dataset build
**Solution**:
- Nothing to do: requests are retried with backoff and missing events are fetched on the next refresh
- If the API blocks every request, wait a few minutes (the block is temporary) and call `POST /api/insights/refresh`

## Rollback Procedures

1. **Backend Rollback**:
   - Stop current backend container/service
   - Deploy previous version image/tag
   - Verify service health

2. **Frontend Rollback**:
   - Revert to previous build
   - Clear browser cache
   - Restart frontend service

## Alerting and Escalation

### Critical Alerts (Require Immediate Attention)

- Backend service down
- API response timeouts (>5s)
- Database connection failures
- High error rates (>10% of requests)

### Warning Alerts

- Cache miss rates >30%
- Slow response times (>2s)
- Memory usage >80%

## Backup Procedures

Regular backups should include:
- Source code repositories
- Database dumps (if applicable)
- Configuration files
- Docker images and containers

## Security Considerations

1. Keep dependencies updated
2. Validate all API inputs
3. Use HTTPS in production
4. Implement proper authentication if needed
5. Regular security scanning of dependencies