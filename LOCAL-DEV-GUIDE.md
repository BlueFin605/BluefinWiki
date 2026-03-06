# Local Full-Stack Development with Aspire

## Overview

BlueFinWiki now supports full-stack local development through Microsoft Aspire orchestration. With a single command, you can run the entire application stack including frontend, backend, and all infrastructure dependencies.

## What's Running

When you start Aspire, the following services are automatically orchestrated:

### Infrastructure Services (Docker Containers)
- **LocalStack** (Port 4566): AWS service emulation (S3, DynamoDB, SES)
- **Cognito Local** (Port 9229): Local Cognito authentication emulator
- **MailHog** (Ports 1025/8025): SMTP email testing (UI at http://localhost:8025)

### Application Services
- **Backend API** (Port 3000): Express wrapper for Lambda functions
- **Frontend** (Port 5173): React/Vite development server

### Observability
- **Aspire Dashboard** (Port 15888): Unified logging, tracing, and metrics

## Quick Start

### Start Everything

From the repository root:

```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

This single command:
1. Builds the Aspire orchestration project
2. Starts all Docker containers (LocalStack, Cognito Local, MailHog)
3. Starts the backend Express server with all Lambda handlers
4. Starts the Vite frontend development server
5. Opens the Aspire Dashboard at http://localhost:15888

### Access Services

- **Aspire Dashboard**: http://localhost:15888 (check logs, traces, metrics)
- **Frontend**: http://localhost:5173 (or check dashboard for assigned port)
- **Backend API**: http://localhost:3000 (or check dashboard for assigned port)
- **MailHog UI**: http://localhost:8025 (view test emails)
- **LocalStack**: http://localhost:4566 (AWS services)

### Stop Everything

Press `Ctrl+C` in the terminal where Aspire is running. This gracefully shuts down all services.

## Backend: Lambda-to-Express Bridge

The backend runs a local Express server that wraps Lambda function handlers, simulating API Gateway locally:

### Available API Endpoints

**Pages**:
- `POST /pages` - Create a new page
- `GET /pages/:guid` - Get page by GUID
- `PUT /pages/:guid` - Update page
- `DELETE /pages/:guid` - Delete page
- `GET /pages/:guid/children` - List child pages
- `POST /pages/:guid/move` - Move page to new parent
- `GET /pages/:guid/backlinks` - Get pages linking to this page
- `GET /search?q=query` - Search pages
- `POST /pages/links/resolve` - Resolve wiki links

**Authentication**:
- `POST /auth/register` - Register new user
- `GET /auth/me` - Get current user info

**Admin**:
- `POST /admin/invitations` - Create invitation
- `GET /admin/invitations` - List invitations
- `DELETE /admin/invitations/:code` - Revoke invitation

**Health**:
- `GET /health` - Health check endpoint

## Environment Configuration

All services are automatically configured with the correct environment variables:

### Backend Environment
```
NODE_ENV=development
PORT=3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566
COGNITO_USER_POOL_ID=local_abc123
COGNITO_CLIENT_ID=local-client-id
COGNITO_ENDPOINT=http://localhost:9229
S3_PAGES_BUCKET=bluefinwiki-pages-local
S3_ATTACHMENTS_BUCKET=bluefinwiki-attachments-local
S3_EXPORTS_BUCKET=bluefinwiki-exports-local
DYNAMODB_USERS_TABLE=bluefinwiki-users-local
DYNAMODB_INVITATIONS_TABLE=bluefinwiki-invitations-local
DYNAMODB_ATTACHMENTS_TABLE=bluefinwiki-attachments-local
DYNAMODB_COMMENTS_TABLE=bluefinwiki-comments-local
DYNAMODB_PAGE_LINKS_TABLE=bluefinwiki-page-links-local
DYNAMODB_ACTIVITY_LOG_TABLE=bluefinwiki-activity-log-local
DYNAMODB_SITE_CONFIG_TABLE=bluefinwiki-site-config-local
FRONTEND_URL=http://localhost:5173
```

### Frontend Environment
```
VITE_API_URL=http://localhost:3000
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=local_abc123
VITE_COGNITO_CLIENT_ID=local-client-id
VITE_COGNITO_ENDPOINT=http://localhost:9229
VITE_LOCALSTACK_ENDPOINT=http://localhost:4566
```

## Development Workflow

### Making Changes

1. **Frontend Changes**: Vite hot-reloads automatically
2. **Backend Changes**: tsx watch restarts the server automatically
3. **View Logs**: Check the Aspire Dashboard for real-time logs from all services

### Running Tests

Tests run independently of the Aspire orchestration:

```powershell
# Frontend tests
cd frontend
npm test

# Backend unit tests
cd backend
npm test

# Backend integration tests
cd backend
npm run test:integration

# All tests
cd backend
npm run test:all
```

### Debugging

1. Open the Aspire Dashboard (http://localhost:15888)
2. Click on any service to view:
   - Real-time logs
   - Environment variables
   - Health status
   - Metrics and traces

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Aspire Dashboard                         │
│               http://localhost:15888                        │
│         (Logs, Traces, Metrics, Health Checks)             │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │  │   Backend    │  │Infrastructure│
│   (Vite)     │──│  (Express)   │──│  Services    │
│  Port 5173   │  │  Port 3000   │  │              │
└──────────────┘  └──────────────┘  │ LocalStack   │
                                    │ Cognito      │
                                    │ MailHog      │
                                    └──────────────┘
```

## Files Added/Modified

### New Files
- `backend/src/local-server.ts` - Express wrapper for Lambda handlers

### Modified Files
- `backend/package.json` - Added dev script and Express dependencies
- `aspire/BlueFinWiki.AppHost/Program.cs` - Added backend and frontend services
- `package.json` - Fixed Windows-compatible postinstall script

## Troubleshooting

### Services Not Starting

Check the Aspire Dashboard logs for each service. Common issues:
- Port already in use (change ports in Program.cs)
- Docker not running (start Docker Desktop)
- npm dependencies missing (run `npm install` in root)

### Backend API Errors

Check:
1. LocalStack is healthy: http://localhost:4566/_localstack/health
2. Backend environment variables in Aspire Dashboard
3. Backend logs in Aspire Dashboard

### Frontend Not Loading

Check:
1. Frontend logs in Aspire Dashboard
2. VITE_API_URL environment variable
3. Browser console for errors

## Next Steps

Now that you have the full stack running locally:

1. **Test the API**: Use the Aspire Dashboard or Postman to test endpoints
2. **Set up LocalStack data**: Run seed scripts to populate local DynamoDB and S3
3. **Configure Cognito Local**: Set up test users for authentication
4. **Integration Testing**: Run end-to-end tests against the local stack

## Resources

- [Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Cognito Local](https://github.com/jagregory/cognito-local)
- [MailHog](https://github.com/mailhog/MailHog)
