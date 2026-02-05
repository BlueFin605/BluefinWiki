# BlueFinWiki - Aspire Local Development Guide

## Overview

This directory contains the .NET Aspire orchestration for local development of BlueFinWiki. Aspire provides:

- **Service Orchestration**: Automatically starts and manages all services (frontend, backend, LocalStack, MailHog)
- **Service Discovery**: Services can communicate using references without hardcoded URLs
- **Observability**: Built-in telemetry, tracing, logging, and metrics via OpenTelemetry
- **Dashboard**: Real-time monitoring at http://localhost:15888 (or port shown in terminal)

## Prerequisites

- .NET 8.0 SDK or later
- Docker Desktop (for LocalStack and MailHog containers)
- Node.js 18+ and npm

## Quick Start

### 1. Start the Aspire AppHost

From the repository root:

```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

Or from the aspire/BlueFinWiki.AppHost directory:

```powershell
dotnet run
```

### 2. Access Services

Once started, you'll see URLs in the terminal. Typical ports:

- **Aspire Dashboard**: http://localhost:15888 (or as shown)
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **LocalStack**: http://localhost:4566
- **MailHog UI**: http://localhost:8025 (view sent emails)

### 3. Monitor with Aspire Dashboard

The Aspire Dashboard provides:

- **Resources**: Status of all running services and containers
- **Console Logs**: Real-time logs from each service
- **Traces**: Distributed tracing across service calls
- **Metrics**: Performance metrics (request rates, latency, etc.)
- **Environment Variables**: View configured environment for each service

## Project Structure

```
aspire/
├── BlueFinWiki.AppHost/          # Aspire orchestration host
│   ├── Program.cs                 # Service definitions and configuration
│   ├── appsettings.json           # Base configuration
│   ├── appsettings.Development.json  # Development overrides with AWS/telemetry config
│   └── appsettings.Secrets.json   # Local secrets (not committed)
├── BlueFinWiki.ServiceDefaults/   # Shared telemetry configuration
│   └── Extensions.cs              # OpenTelemetry setup
└── localstack-data/               # LocalStack persistent data (created on first run)
```

## Service Configuration

### Backend (Node.js API)

Configured in [Program.cs](BlueFinWiki.AppHost/Program.cs):

- **Path**: `../../backend`
- **Port**: 3000
- **Environment Variables**:
  - AWS credentials for LocalStack
  - S3 bucket names
  - DynamoDB table names
  - SMTP settings for MailHog
  - JWT configuration
  - OpenTelemetry settings

### Frontend (Vite)

- **Path**: `../../frontend`
- **Port**: 5173
- **Environment Variables**:
  - `VITE_API_URL`: Backend API URL

### LocalStack (AWS Emulation)

- **Services**: S3, DynamoDB, SES
- **Port**: 4566
- **Persistence**: Enabled with bind mount to `./localstack-data`
- **Usage**: Backend automatically connects via `AWS_ENDPOINT` environment variable

### MailHog (SMTP Testing)

- **UI Port**: 8025 - View sent emails
- **SMTP Port**: 1025 - Backend sends emails here

## Service Dependencies

Services start in order based on `.WaitFor()` dependencies:

1. **LocalStack** and **MailHog** (containers start first)
2. **Backend** (waits for LocalStack and MailHog)
3. **Frontend** (waits for Backend)

## Environment Variables Reference

### AWS Configuration (Development)

All AWS services point to LocalStack:

- `AWS_ENDPOINT`: http://localhost:4566
- `AWS_REGION`: us-east-1
- `AWS_ACCESS_KEY_ID`: test
- `AWS_SECRET_ACCESS_KEY`: test

### S3 Buckets (Local)

- `S3_PAGES_BUCKET`: bluefinwiki-pages-local
- `S3_ATTACHMENTS_BUCKET`: bluefinwiki-attachments-local
- `S3_EXPORTS_BUCKET`: bluefinwiki-exports-local

### DynamoDB Tables (Local)

- `DYNAMODB_USERS_TABLE`: bluefinwiki-users-local
- `DYNAMODB_INVITATIONS_TABLE`: bluefinwiki-invitations-local
- `DYNAMODB_ATTACHMENTS_TABLE`: bluefinwiki-attachments-local
- `DYNAMODB_COMMENTS_TABLE`: bluefinwiki-comments-local
- `DYNAMODB_PAGE_LINKS_TABLE`: bluefinwiki-page-links-local
- `DYNAMODB_ACTIVITY_LOG_TABLE`: bluefinwiki-activity-log-local
- `DYNAMODB_SITE_CONFIG_TABLE`: bluefinwiki-site-config-local

### SMTP Configuration

- `SMTP_HOST`: localhost
- `SMTP_PORT`: 1025

## Telemetry & Observability

### OpenTelemetry Configuration

Configured in [BlueFinWiki.ServiceDefaults/Extensions.cs](BlueFinWiki.ServiceDefaults/Extensions.cs):

- **Tracing**: HTTP requests, service-to-service calls
- **Metrics**: Request rates, latency, errors, runtime metrics
- **Logging**: Structured logging with correlation IDs

### Viewing Telemetry

1. Open the Aspire Dashboard (URL shown when starting)
2. Navigate to:
   - **Traces**: See distributed traces across services
   - **Metrics**: View performance metrics and charts
   - **Console Logs**: Real-time structured logs

### Trace Correlation

Each request gets a unique trace ID that flows through all services:
- Frontend → Backend → AWS (LocalStack)
- View the complete request flow in the Traces tab

## Troubleshooting

### Services Won't Start

1. **Check Docker**: Ensure Docker Desktop is running
2. **Port Conflicts**: Check if ports 3000, 4566, 5173, 8025, or 15888 are in use
3. **Dependencies**: Run `npm install` in both `frontend/` and `backend/` directories

### LocalStack Issues

- **Data Persistence**: LocalStack data is stored in `./localstack-data`
- **Reset State**: Delete `./localstack-data` directory to start fresh
- **Check Logs**: View LocalStack logs in Aspire Dashboard → Console Logs

### Backend Connection Issues

- Verify LocalStack is running: http://localhost:4566/_localstack/health
- Check AWS configuration in environment variables
- View backend logs in Aspire Dashboard

### Frontend Build Errors

- Ensure `package.json` and dependencies are installed
- Check Vite configuration in `frontend/vite.config.ts`
- View frontend logs in Aspire Dashboard

## Advanced Usage

### Custom Configuration

Edit [appsettings.Development.json](BlueFinWiki.AppHost/appsettings.Development.json) to:
- Change port mappings
- Adjust AWS resource names
- Configure additional environment variables

### Local Secrets

1. Create `appsettings.Secrets.json` (already templated)
2. Add sensitive configuration (not committed to git)
3. Reference in `Program.cs` if needed

### Adding New Services

Edit [Program.cs](BlueFinWiki.AppHost/Program.cs):

```csharp
var newService = builder.AddContainer("service-name", "image", "tag")
    .WithEnvironment("KEY", "value")
    .WithHttpEndpoint(port: 8080, targetPort: 8080);

// Reference in other services
backend.WithReference(newService);
```

### Service-to-Service Communication

Services communicate using references:

```csharp
// In Program.cs
backend.WithReference(localstack);

// In backend code, use environment variable:
// process.env.AWS_ENDPOINT (automatically set by Aspire)
```

## Production vs. Local Development

### Local (Aspire)

- Services run as processes/containers on localhost
- LocalStack emulates AWS services
- MailHog captures emails
- No costs, fast iteration

### Production (AWS)

- Lambda functions in AWS
- Real S3, DynamoDB, SES services
- API Gateway for routing
- CloudFront CDN
- Deployed via CDK (see `infrastructure/`)

**Note**: Aspire is for local development only. Production uses AWS native services.

## Next Steps

1. **Start Developing**: Run `dotnet run --project aspire/BlueFinWiki.AppHost`
2. **Open Dashboard**: Monitor services in real-time
3. **View Logs**: Check console logs for each service
4. **Test Features**: Frontend at http://localhost:5173
5. **View Emails**: MailHog UI at http://localhost:8025

## References

- [.NET Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [MailHog Documentation](https://github.com/mailhog/MailHog)

## Task Status

✅ Task 1.2 - Local Development with Aspire: **COMPLETED**

- ✅ Aspire AppHost project structure created
- ✅ ServiceDefaults project with OpenTelemetry configured
- ✅ Node.js project references for backend and frontend
- ✅ LocalStack container for AWS service emulation
- ✅ MailHog container for SMTP testing
- ✅ Service orchestration with dependencies (WaitFor)
- ✅ Telemetry, tracing, logging, and metrics enabled
- ✅ Local environment configuration (appsettings.Development.json)
- ✅ Service discovery and communication configured
