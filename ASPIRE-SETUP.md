# Microsoft Aspire Local Development Setup

## Overview

BlueFinWiki uses **Microsoft Aspire** for local development orchestration and observability. Aspire provides:

- **Service Orchestration**: Automatic startup of frontend, backend, and dependencies
- **Service Discovery**: Seamless service-to-service communication
- **Observability**: Built-in dashboard for logs, traces, and metrics
- **Local AWS Emulation**: LocalStack integration for S3, DynamoDB, SES

## Prerequisites

- **.NET 8.0 SDK** or later ([download](https://dotnet.microsoft.com/download))
- **Node.js 18+** and npm
- **Docker Desktop** (for LocalStack and other containers)
- **Visual Studio 2022** or **VS Code** with C# extension

## Project Structure

```
aspire/
├── BlueFinWiki.AppHost/              # Orchestration project
│   ├── BlueFinWiki.AppHost.csproj
│   ├── Program.cs                    # Service configuration
│   └── appsettings.json
└── BlueFinWiki.ServiceDefaults/      # Shared configuration
    ├── BlueFinWiki.ServiceDefaults.csproj
    └── Extensions.cs                 # Telemetry and health checks
```

## Quick Start

### 1. Install Aspire Workload

```bash
dotnet workload update
dotnet workload install aspire
```

### 2. Create Aspire Projects

```bash
# From project root
cd aspire

# Create AppHost
dotnet new aspire-apphost -n BlueFinWiki.AppHost

# Create ServiceDefaults
dotnet new aspire-servicedefaults -n BlueFinWiki.ServiceDefaults

# Add references
cd BlueFinWiki.AppHost
dotnet add reference ../BlueFinWiki.ServiceDefaults
```

### 3. Configure AppHost Program.cs

```csharp
var builder = DistributedApplication.CreateBuilder(args);

// LocalStack for AWS service emulation
var localstack = builder.AddContainer("localstack", "localstack/localstack")
    .WithEnvironment("SERVICES", "s3,dynamodb,ses")
    .WithEnvironment("DEBUG", "1")
    .WithHttpEndpoint(port: 4566, targetPort: 4566, name: "aws")
    .WithHttpEndpoint(port: 4571, targetPort: 4571, name: "web");

// SMTP server for email testing (MailHog)
var mailhog = builder.AddContainer("mailhog", "mailhog/mailhog")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "ui")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "smtp");

// Backend (Node.js/TypeScript Lambda functions)
var backend = builder.AddNpmApp("backend", "../backend")
    .WithReference(localstack)
    .WithReference(mailhog)
    .WithEnvironment("AWS_ENDPOINT", localstack.GetEndpoint("aws"))
    .WithEnvironment("AWS_ACCESS_KEY_ID", "test")
    .WithEnvironment("AWS_SECRET_ACCESS_KEY", "test")
    .WithEnvironment("AWS_REGION", "us-east-1")
    .WithEnvironment("SMTP_HOST", "localhost")
    .WithEnvironment("SMTP_PORT", "1025")
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

// Frontend (Vite React app)
var frontend = builder.AddNpmApp("frontend", "../frontend", "dev")
    .WithReference(backend)
    .WithEnvironment("VITE_API_URL", backend.GetEndpoint("http"))
    .WithHttpEndpoint(port: 5173, env: "PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
```

### 4. Run the Application

```bash
# From aspire/BlueFinWiki.AppHost directory
dotnet run

# Or from project root
dotnet run --project aspire/BlueFinWiki.AppHost
```

This will:
1. Start LocalStack (S3, DynamoDB, SES emulation)
2. Start MailHog (email viewing at http://localhost:8025)
3. Start the backend Node.js service
4. Start the frontend Vite dev server
5. Open Aspire Dashboard (typically at http://localhost:15888)

## Aspire Dashboard

The Aspire Dashboard provides real-time observability:

- **Resources**: View all running services and containers
- **Console Logs**: Structured logs from all services
- **Traces**: Distributed tracing across services
- **Metrics**: Performance metrics and resource usage
- **Environment**: View and edit environment variables

Access at: http://localhost:15888 (or port shown in console)

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
