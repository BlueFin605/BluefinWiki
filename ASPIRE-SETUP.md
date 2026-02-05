# Microsoft Aspire Local Development Setup

## Overview

BlueFinWiki uses **Microsoft Aspire** for local development orchestration and observability. Aspire provides:

- **Service Orchestration**: Automatic startup of frontend, backend, and dependencies
- **Service Discovery**: Seamless service-to-service communication  
- **Observability**: Built-in dashboard for logs, traces, and metrics
- **Local AWS Emulation**: LocalStack integration for S3, DynamoDB, SES
- **Container Management**: Automatic startup of LocalStack and MailHog

## Prerequisites

- **.NET 8.0 SDK** or later ([download](https://dotnet.microsoft.com/download))
- **Node.js 18+** and npm ([download](https://nodejs.org/))
- **Docker Desktop** ([download](https://www.docker.com/products/docker-desktop/))
- **Visual Studio 2022** or **VS Code** with C# extension

## Automated Setup (Recommended)

Run the setup script from the repository root:

```powershell
.\setup-aspire.ps1
```

This script will:
1. ✓ Check .NET SDK version
2. ✓ Install .NET Aspire workload
3. ✓ Verify Docker availability
4. ✓ Build the Aspire AppHost
5. ✓ Install Node.js dependencies for frontend and backend

## Manual Setup

### 1. Install Aspire Workload

```powershell
dotnet workload update
dotnet workload install aspire
```

Verify installation:

```powershell
dotnet workload list
```

You should see `aspire` in the installed workloads.

### 2. Start Docker Desktop

Ensure Docker Desktop is running. LocalStack and MailHog require Docker.

Verify Docker is running:

```powershell
docker info
```

### 3. Install Node.js Dependencies

Install dependencies for frontend and backend:

```powershell
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

## Project Structure

```
aspire/
├── BlueFinWiki.AppHost/              # Orchestration project (✓ Task 1.2 Complete)
│   ├── BlueFinWiki.AppHost.csproj
│   ├── Program.cs                    # Service configuration with LocalStack, MailHog
│   ├── appsettings.json              # Base configuration
│   ├── appsettings.Development.json  # Local dev settings with AWS config
│   ├── appsettings.Secrets.json      # Local secrets (not committed)
│   └── localstack-data/              # LocalStack persistent data (created at runtime)
├── BlueFinWiki.ServiceDefaults/      # Shared configuration (✓ Task 1.2 Complete)
│   ├── BlueFinWiki.ServiceDefaults.csproj
│   └── Extensions.cs                 # OpenTelemetry, health checks, service discovery
├── ASPIRE-LOCAL-DEV.md               # Detailed local development guide
└── .gitignore                        # Excludes secrets and local data
```

## Running the Application

### Start All Services

From the repository root:

```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

Or from the AppHost directory:

```powershell
cd aspire/BlueFinWiki.AppHost
dotnet run
```

### What Starts Automatically

1. **LocalStack** (port 4566) - AWS service emulation (S3, DynamoDB, SES)
2. **MailHog** (ports 8025, 1025) - SMTP server for email testing
3. **Backend** (port 3000) - Node.js API (Lambda functions running locally)
4. **Frontend** (port 5173) - Vite development server

### Access the Services

After startup, you'll see URLs in the terminal:

- **Aspire Dashboard**: http://localhost:15888 (or port shown)
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **LocalStack**: http://localhost:4566
- **MailHog UI**: http://localhost:8025 (view sent emails)

## Aspire Dashboard

The Aspire Dashboard provides comprehensive observability:

### Resources Tab

- View status of all services (Running, Stopped, Failed)
- See resource health and uptime
- Quick links to each service

### Console Logs Tab

- Real-time logs from all services
- Filter by service name
- Search log content
- Color-coded by log level

### Traces Tab

- Distributed tracing across services
- View request flow: Frontend → Backend → LocalStack
- Analyze performance bottlenecks
- Trace duration and timing breakdown

### Metrics Tab

- Performance metrics (request rates, latency, errors)
- Runtime metrics (CPU, memory, GC)
- Custom application metrics
- Time-series charts

### Environment Variables Tab

- View all configured environment variables per service
- Useful for debugging configuration issues

## Configuration Details

### Backend Environment Variables

Automatically configured by Aspire (see [Program.cs](aspire/BlueFinWiki.AppHost/Program.cs)):

```
NODE_ENV=development
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

S3 Buckets:
- S3_PAGES_BUCKET=bluefinwiki-pages-local
- S3_ATTACHMENTS_BUCKET=bluefinwiki-attachments-local
- S3_EXPORTS_BUCKET=bluefinwiki-exports-local

DynamoDB Tables:
- DYNAMODB_USERS_TABLE=bluefinwiki-users-local
- DYNAMODB_INVITATIONS_TABLE=bluefinwiki-invitations-local
- DYNAMODB_ATTACHMENTS_TABLE=bluefinwiki-attachments-local
- DYNAMODB_COMMENTS_TABLE=bluefinwiki-comments-local
- DYNAMODB_PAGE_LINKS_TABLE=bluefinwiki-page-links-local
- DYNAMODB_ACTIVITY_LOG_TABLE=bluefinwiki-activity-log-local
- DYNAMODB_SITE_CONFIG_TABLE=bluefinwiki-site-config-local

SMTP:
- SMTP_HOST=localhost
- SMTP_PORT=1025

JWT:
- JWT_SECRET=local-dev-secret-change-in-production
- JWT_EXPIRY=30d

OpenTelemetry:
- OTEL_SERVICE_NAME=bluefinwiki-backend
- OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### Frontend Environment Variables

```
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=BlueFinWiki
VITE_ENVIRONMENT=local
```

### Service Dependencies

Services start in order using `.WaitFor()`:

1. **LocalStack** and **MailHog** start first (containers)
2. **Backend** waits for LocalStack and MailHog
3. **Frontend** waits for Backend

This ensures services are available before dependent services start.

## OpenTelemetry Configuration

OpenTelemetry is configured in [BlueFinWiki.ServiceDefaults/Extensions.cs](aspire/BlueFinWiki.ServiceDefaults/Extensions.cs):

### Tracing

- Automatic instrumentation for:
  - HTTP requests (client and server)
  - ASP.NET Core requests
  - Service-to-service calls
- Context propagation across services
- Trace IDs for correlation

### Metrics

- Runtime instrumentation (CPU, memory, GC)
- HTTP client metrics (request rates, latency)
- ASP.NET Core metrics (request duration, errors)
- Custom application metrics

### Logging

- Structured logging with correlation IDs
- Log levels configurable per namespace
- Automatic log forwarding to Aspire Dashboard
- Include formatted messages and scopes

## LocalStack Configuration

LocalStack provides local AWS service emulation:

### Configured Services

- **S3**: Object storage for pages, attachments, exports
- **DynamoDB**: NoSQL database for users, metadata
- **SES**: Email sending (captured by MailHog in local dev)

### Data Persistence

LocalStack data is persisted to `./localstack-data` directory:

- Survives container restarts
- Delete directory to reset all data
- Automatically created on first run

### Accessing LocalStack

- **Edge Port**: 4566 (all services)
- **Health Check**: http://localhost:4566/_localstack/health
- **AWS CLI**: Use `--endpoint-url http://localhost:4566`

Example:

```powershell
aws --endpoint-url http://localhost:4566 s3 ls
```

## MailHog Configuration

MailHog captures all emails sent by the backend:

### Ports

- **SMTP**: 1025 (backend sends here)
- **Web UI**: 8025 (view emails)

### Features

- View all sent emails in web interface
- Search and filter emails
- Download emails as .eml files
- API for programmatic access

### Viewing Emails

Open http://localhost:8025 to see:
- Password reset emails
- Invitation emails
- Notification emails

## Troubleshooting

### "NETSDK1147: To build this project, the following workloads must be installed: aspire"

**Solution**: Install the Aspire workload:

```powershell
dotnet workload install aspire
```

### "Docker daemon is not running"

**Solution**: Start Docker Desktop before running Aspire.

### Port Already in Use

**Error**: "Address already in use" for ports 3000, 4566, 5173, 8025, or 15888

**Solution**: 
1. Find and stop the process using the port:
   ```powershell
   netstat -ano | findstr :<port>
   taskkill /PID <pid> /F
   ```
2. Or change the port in [Program.cs](aspire/BlueFinWiki.AppHost/Program.cs)

### LocalStack Container Won't Start

**Solution**:
1. Check Docker is running
2. Pull the latest image: `docker pull localstack/localstack:latest`
3. Delete `./localstack-data` and restart

### Backend Fails to Connect to LocalStack

**Solution**:
1. Verify LocalStack is running in Aspire Dashboard
2. Check http://localhost:4566/_localstack/health
3. View backend logs for connection errors
4. Ensure `AWS_ENDPOINT` environment variable is set

### Frontend Build Errors

**Solution**:
1. Ensure Node.js 18+ is installed
2. Run `npm install` in `frontend/` directory
3. Check `vite.config.ts` for configuration errors
4. View frontend logs in Aspire Dashboard

### Aspire Dashboard Not Opening

**Solution**:
1. Check the terminal output for the dashboard URL
2. Port may be different from 15888 if in use
3. Access the URL shown: http://localhost:<port>

## Development Workflow

### Typical Development Session

1. **Start Aspire**:
   ```powershell
   dotnet run --project aspire/BlueFinWiki.AppHost
   ```

2. **Open Dashboard**: Click the Aspire Dashboard URL in the terminal

3. **Develop**:
   - Edit frontend code → Vite hot reloads automatically
   - Edit backend code → Restart backend service in Aspire
   - View logs and traces in Dashboard

4. **Test Emails**: Open http://localhost:8025 to see sent emails

5. **Monitor Performance**: Use Traces and Metrics tabs in Dashboard

6. **Stop**: Press `Ctrl+C` in the terminal running Aspire

### Making Changes

- **Frontend**: Changes auto-reload (Vite HMR)
- **Backend**: Restart service or stop/start Aspire
- **Aspire Config**: Restart Aspire after editing [Program.cs](aspire/BlueFinWiki.AppHost/Program.cs)

## Advanced Configuration

### Adding New Environment Variables

Edit [Program.cs](aspire/BlueFinWiki.AppHost/Program.cs):

```csharp
backend.WithEnvironment("NEW_VAR", "value");
```

### Changing Ports

```csharp
backend.WithHttpEndpoint(port: 4000, targetPort: 4000, name: "backend-api");
```

### Adding New Services

```csharp
var redis = builder.AddContainer("redis", "redis", "latest")
    .WithEndpoint(port: 6379, targetPort: 6379);

backend.WithReference(redis);
```

### Custom LocalStack Services

Edit [Program.cs](aspire/BlueFinWiki.AppHost/Program.cs):

```csharp
.WithEnvironment("SERVICES", "s3,dynamodb,ses,sqs,sns")
```

## Production vs. Local

### Local Development (Aspire)

- ✓ Services run as processes/containers
- ✓ LocalStack emulates AWS
- ✓ MailHog captures emails
- ✓ Fast iteration, no costs
- ✓ Full observability with Dashboard

### Production (AWS)

- Lambda functions
- Real S3, DynamoDB, SES
- API Gateway for routing
- CloudFront CDN
- Deployed via CDK (see `infrastructure/`)

**Important**: Aspire is for local development only. Production uses AWS native services deployed via CDK.

## Next Steps

1. ✓ **Setup Complete**: Task 1.2 is fully implemented
2. **Run Aspire**: `dotnet run --project aspire/BlueFinWiki.AppHost`
3. **Explore Dashboard**: Monitor services, logs, traces
4. **Start Development**: Begin implementing backend and frontend features
5. **Continue with Task 1.3**: AWS Cloud Infrastructure (CDK)

## Additional Resources

- [Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/)
- [LocalStack Docs](https://docs.localstack.cloud/)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [MailHog Repository](https://github.com/mailhog/MailHog)
- [Detailed Local Dev Guide](aspire/ASPIRE-LOCAL-DEV.md)

## Task Status

✅ **Task 1.2 - Local Development with Aspire: COMPLETED**

All subtasks completed:
- ✅ Aspire AppHost project structure
- ✅ ServiceDefaults with OpenTelemetry
- ✅ Node.js project references (backend, frontend)
- ✅ LocalStack container for AWS emulation
- ✅ MailHog container for SMTP
- ✅ Service orchestration with WaitFor dependencies
- ✅ Telemetry, tracing, logging, metrics
- ✅ Local environment configuration
- ✅ Service discovery and communication
- ✅ Documentation and setup scripts

The AppHost is already configured in `aspire/BlueFinWiki.AppHost/Program.cs` with:
- LocalStack container for AWS service emulation (S3, DynamoDB, SES)
- MailHog container for email testing
- Backend Node.js service with automatic environment configuration
- Frontend Vite service with API URL injection

No manual configuration needed.

### 4. Run the Application

```bash
# From project root
cd aspire/BlueFinWiki.AppHost
dotnet run
```

Or with the shorthand from anywhere in the project:

```bash
dotnet run --project aspire/BlueFinWiki.AppHost
```

This will:
1. Start LocalStack (S3, DynamoDB, SES emulation)
2. Start MailHog (email viewing at http://localhost:8025)
3. Start the backend Node.js service
4. Start the frontend Vite dev server
5. Open Aspire Dashboard (typically at http://localhost:15000)

## Aspire Dashboard

The Aspire Dashboard provides real-time observability:

- **Resources**: View all running services and containers
- **Console Logs**: Structured logs from all services
- **Traces**: Distributed tracing across services
- **Metrics**: Performance metrics and resource usage
- **Environment**: View and edit environment variables

Access at: http://localhost:15000 (or port shown in console)

## Service Configuration

### Backend Service

Create or update `backend/package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

### Frontend Service

Update `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '5173'),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

## LocalStack Setup

### Initialize LocalStack Resources

Create `scripts/init-localstack.sh`:

```bash
#!/bin/bash
# Wait for LocalStack to be ready
until aws --endpoint-url=http://localhost:4566 s3 ls; do
  echo "Waiting for LocalStack..."
  sleep 2
done

# Create S3 buckets
aws --endpoint-url=http://localhost:4566 s3 mb s3://bluefin-pages
aws --endpoint-url=http://localhost:4566 s3 mb s3://bluefin-attachments
aws --endpoint-url=http://localhost:4566 s3 mb s3://bluefin-exports

# Enable versioning on pages bucket
aws --endpoint-url=http://localhost:4566 s3api put-bucket-versioning \
  --bucket bluefin-pages --versioning-configuration Status=Enabled

# Create DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name users \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=email,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes "IndexName=email-index,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL}"

echo "LocalStack initialization complete!"
```

Run after Aspire starts:

```bash
chmod +x scripts/init-localstack.sh
./scripts/init-localstack.sh
```

Or integrate into AppHost with a setup container.

## Development Workflow

### Starting Development

1. **Start Aspire**: `dotnet run --project aspire/BlueFinWiki.AppHost`
2. **View Dashboard**: Open http://localhost:15888
3. **Access Frontend**: http://localhost:5173
4. **Access Backend**: http://localhost:3000
5. **View Emails**: http://localhost:8025 (MailHog)

### Making Changes

- **Backend**: Edit TypeScript files, Aspire auto-restarts with `tsx watch`
- **Frontend**: Edit React files, Vite HMR applies changes instantly
- **View Logs**: Check Aspire Dashboard → Console Logs
- **Debug Traces**: Check Aspire Dashboard → Traces

### Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test

# Run integration tests (with Aspire running)
npm run test:integration
```

## Environment Variables

### Backend (.env.development)

```env
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
S3_PAGES_BUCKET=bluefin-pages
S3_ATTACHMENTS_BUCKET=bluefin-attachments
DYNAMODB_TABLE_USERS=users
SMTP_HOST=localhost
SMTP_PORT=1025
JWT_SECRET=local-dev-secret-change-in-production
```

### Frontend (.env.development)

```env
VITE_API_URL=http://localhost:3000
VITE_ENVIRONMENT=development
```

## Troubleshooting

### Port Conflicts

If ports are in use, update in AppHost Program.cs:

```csharp
.WithHttpEndpoint(port: 3001, env: "PORT") // Change from 3000
```

### LocalStack Not Ready

Increase wait time in init script or add health checks:

```csharp
var localstack = builder.AddContainer("localstack", "localstack/localstack")
    .WithHealthCheck("http://localhost:4566/_localstack/health");
```

### Services Not Connecting

Check Aspire Dashboard → Resources → Environment tab for correct URLs.

### Docker Issues

Ensure Docker Desktop is running:

```bash
docker ps  # Should list running containers
```

## Benefits Over Manual Setup

| Aspect | Manual Setup | With Aspire |
|--------|-------------|-------------|
| Service Startup | Run each service separately | Single command starts all |
| Configuration | Manual .env management | Centralized in AppHost |
| Observability | Check logs individually | Unified dashboard with traces |
| Service Discovery | Hardcoded URLs | Automatic endpoint resolution |
| Dependencies | Start manually in order | Aspire handles orchestration |
| Development Speed | Slow setup, context switching | Fast, integrated workflow |

## Production Deployment

**Important**: Aspire is for **local development only**. Production uses:

- **AWS Lambda** for backend (not Node.js server)
- **S3/CloudFront** for frontend (static hosting)
- **Real AWS services** (not LocalStack)
- **CDK** for infrastructure deployment

To deploy to AWS:

```bash
cd infrastructure
cdk deploy --all
```

## Additional Resources

- [Microsoft Aspire Documentation](https://learn.microsoft.com/dotnet/aspire/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Aspire + Node.js Integration](https://learn.microsoft.com/dotnet/aspire/get-started/build-aspire-apps-with-nodejs)
- [OpenTelemetry for Observability](https://opentelemetry.io/)

## Next Steps

1. Complete Aspire setup as per Phase 1, Week 1 tasks
2. Configure all services in AppHost
3. Test full local development workflow
4. Document team-specific setup variations
5. Create developer onboarding guide with Aspire

---

**Last Updated**: February 6, 2026  
**Maintained By**: Development Team
