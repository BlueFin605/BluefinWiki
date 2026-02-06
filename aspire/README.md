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
- **Cognito Local** (port 9229): Cognito User Pool emulation for authentication testing
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

### Cognito Local
- Emulates AWS Cognito User Pools locally
- Access endpoint: http://localhost:9229
- Supports user creation, authentication, and JWT token generation
- Persists data in `./cognito-local-data` directory
- See [COGNITO-INTEGRATION.md](../COGNITO-INTEGRATION.md) for setup details

### MailHog
- Captures emails sent from the application
- Web UI: http://localhost:8025
- SMTP port: 1025
- View password reset emails, invitations, and notifications

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
- `COGNITO_ENDPOINT`: Points to Cognito Local
- `COGNITO_USER_POOL_ID`: Local test user pool ID
- `COGNITO_CLIENT_ID`: Local test client ID
- `SMTP_HOST` and `SMTP_PORT`: Point to MailHog
- `VITE_API_URL`: Points to backend API

**Note**: See [COGNITO-INTEGRATION.md](../COGNITO-INTEGRATION.md) for details on creating local test users.

## Troubleshooting

If services fail to start:

1. Ensure Docker Desktop is running
2. Check that ports 3000, 4566, 5173, 8025, 9229, and 15000 are available
3. Review logs in the Aspire Dashboard
4. Try `dotnet clean` and rebuild
5. For Cognito Local issues, delete `./cognito-local-data` and restart

## Production vs Local

Note: Aspire is only for local development. Production deployments use:
- AWS Lambda (instead of local Node.js service)
- Real AWS S3, DynamoDB, SES (instead of LocalStack)
- Real AWS Cognito User Pools (instead of Cognito Local)
- CloudFront + S3 (instead of Vite dev server)

**Key Differences**:
- **Authentication**: Local uses cognito-local for testing; production uses AWS Cognito with real email verification
- **Email**: Local uses MailHog (port 8025); production uses AWS SES or Cognito default email
- **Tokens**: Local JWT tokens are simpler; production uses full Cognito JWT verification with JWKS
- **Data Persistence**: Local data is ephemeral (deleted on container restart unless bound to volume); production data is durable

See [COGNITO-INTEGRATION.md](../COGNITO-INTEGRATION.md) for detailed comparison.
