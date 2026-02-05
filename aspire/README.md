# Aspire AppHost Solution

This directory contains the Microsoft Aspire AppHost project for BlueFinWiki local development orchestration.

## Structure

- **BlueFinWiki.AppHost**: Main orchestration project that configures and runs all services
- **BlueFinWiki.ServiceDefaults**: Shared configuration for OpenTelemetry, health checks, and service discovery

## Running Locally

To run the entire BlueFinWiki stack with Aspire:

```bash
cd aspire/BlueFinWiki.AppHost
dotnet run
```

This will start:
- **LocalStack** (port 4566): AWS service emulation (S3, DynamoDB, SES)
- **MailHog** (port 8025): Email testing UI
- **Backend** (port 3000): Lambda functions running as Node.js service
- **Frontend** (port 5173): Vite dev server

## Aspire Dashboard

Once running, access the Aspire Dashboard at: http://localhost:15000

The dashboard provides:
- Real-time service status and logs
- Distributed tracing visualization
- Metrics and performance monitoring
- Resource management

## Service Configuration

### LocalStack
- Emulates AWS services locally
- Access endpoint: http://localhost:4566
- Configured services: S3, DynamoDB, SES
- Use AWS CLI with `--endpoint-url=http://localhost:4566`

### MailHog
- Captures emails sent from the application
- Web UI: http://localhost:8025
- SMTP port: 1025

### Backend
- Node.js Lambda functions
- API endpoint: http://localhost:3000
- Auto-configured to use LocalStack

### Frontend
- Vite dev server with hot reload
- Web UI: http://localhost:5173
- Auto-configured to use backend API

## Requirements

- .NET 8.0 SDK or later
- Docker Desktop (for LocalStack and MailHog containers)
- Node.js 18+ (for backend and frontend)

## Environment Variables

All environment variables are automatically configured by Aspire:
- `AWS_ENDPOINT`: Points to LocalStack
- `SMTP_HOST` and `SMTP_PORT`: Point to MailHog
- `VITE_API_URL`: Points to backend API

## Troubleshooting

If services fail to start:

1. Ensure Docker Desktop is running
2. Check that ports 3000, 4566, 5173, 8025, and 15000 are available
3. Review logs in the Aspire Dashboard
4. Try `dotnet clean` and rebuild

## Production vs Local

Note: Aspire is only for local development. Production deployments use:
- AWS Lambda (instead of local Node.js service)
- Real AWS S3, DynamoDB, SES (instead of LocalStack)
- CloudFront + S3 (instead of Vite dev server)
