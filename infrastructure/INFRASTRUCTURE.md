# BlueFinWiki Infrastructure - AWS CDK (C#)

## Overview

This directory contains the AWS CDK C# infrastructure code for BlueFinWiki. The infrastructure uses a **single Unified Stack** (`UnifiedStack.cs`) that combines all resources into one CloudFormation stack with logical sections for Storage, Database, CDN, Auth (Cognito), and Compute (Lambda + API Gateway).

> **Note**: The original four-stack architecture (Storage, Database, Compute, CDN) was consolidated into a Unified Stack for simpler deployment and cross-resource referencing. The documentation below reflects the current unified architecture.

## Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download)
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html): `npm install -g aws-cdk`
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
- AWS Account with appropriate permissions

## Project Structure

```
infrastructure/
├── cdk.json                       # CDK app configuration
├── README.md                      # This file
├── deploy-production.ps1          # Production deployment script (ACM certs, Cognito domain, Google OAuth)
└── src/
    └── Infrastructure/
        ├── Program.cs             # CDK app entry point with environment and context configuration
        ├── Infrastructure.csproj
        └── Stacks/
            └── UnifiedStack.cs    # Single stack: Storage + Database + CDN + Auth + Compute
```

## Unified Stack Overview (`BlueFinWiki-{env}`)

The Unified Stack (`UnifiedStack.cs`) combines all resources into logical sections:

### Storage Resources
S3 buckets for application data:
- **Pages Bucket**: Wiki page content and metadata (JSON format, versioned)
- **Attachments Bucket**: Uploaded files (images, PDFs, etc.)
- **Exports Bucket**: Generated PDFs and HTML exports (7-day auto-cleanup)

### Database Resources
DynamoDB tables for metadata and user data:
- **Users**: Authentication and user profiles (GSI: email-index)
- **Invitations**: Invite codes with TTL
- **Page Links**: Internal wiki links and backlinks (GSI: targetGuid-index)
- **Attachments**: File metadata (GSI: pageGuid-index)
- **Comments**: Page discussions (GSI: pageGuid-createdAt-index)
- **Activity Log**: Audit trail with TTL
- **User Preferences**: Dashboard customization, favorites
- **Site Config**: Global wiki settings

### Auth Resources (Cognito)
AWS Cognito for authentication:
- **User Pool**: Email/password auth with configurable password policy
- **User Pool Domain**: Custom domain (auth.bluefin605.com) or Cognito prefix domain
- **Web Client**: OAuth2 app client for frontend (authorization code flow)
- **Native Client**: App client for backend/admin operations
- **Google Identity Provider**: Federated login via Google OAuth (optional, controlled by `enableGoogleLogin` context)
- **Pre-Signup Lambda Trigger**: Enforces invite-only access, links federated identities

### Compute Resources
Serverless compute:
- **API Gateway REST API**: Public API endpoints with custom domain support (api.bluefin605.com)
- **Lambda Functions**: Backend logic (Node.js handlers)
- **Secrets Manager**: Google OAuth client secret (when Google login enabled)
- **IAM Roles**: Lambda execution roles with least privilege

### CDN Resources
Content delivery and frontend hosting:
- **Frontend S3 Bucket**: React SPA static files
- **CloudFront Distribution**: Global CDN with caching policies, custom domain (wiki.bluefin605.com)
- **Origin Access Identity**: Secure S3 access

### CDK Context Parameters

The stack accepts these context parameters via `--context`:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `environment` | Deployment environment | `dev`, `staging`, `production` |
| `domainName` | Custom domain name | `bluefin605.com` |
| `certificateArnUsEast1` | ACM cert ARN in us-east-1 (for CloudFront/Cognito) | `arn:aws:acm:us-east-1:...` |
| `certificateArnRegional` | ACM cert ARN in deployment region (for API Gateway) | `arn:aws:acm:ap-southeast-2:...` |
| `enableCognitoCustomDomain` | Enable custom Cognito domain | `true`/`false` |
| `enableGoogleLogin` | Enable Google social login | `true`/`false` |

## Environment Configuration

Three environments are supported: `dev`, `staging`, and `production`.

### Environment Differences

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| S3 Versioning | ✓ | ✓ | ✓ |
| DynamoDB Backups | ✗ | ✓ | ✓ |
| Billing Mode | PAY_PER_REQUEST | PAY_PER_REQUEST | PAY_PER_REQUEST |
| Log Retention | 7 days | 14 days | 90 days |
| CloudFront Price Class | 100 (cheapest) | 100 | 200 (global) |
| Removal Policy | DESTROY | DESTROY | RETAIN |

## Usage

### Build the Project

```bash
cd infrastructure/src
dotnet build
```

### Synthesize CloudFormation Templates

```bash
# Dev environment (default)
cdk synth --context environment=dev

# Staging environment
cdk synth --context environment=staging

# Production environment
cdk synth --context environment=production
```

### Deploy Infrastructure

#### Deploy Dev Environment

```bash
cdk deploy --context environment=dev --all
```

#### Deploy to Production

For production deployment with custom domains, ACM certificates, Cognito domain, and Google OAuth, use the production deployment script:

```powershell
# From infrastructure directory
./deploy-production.ps1
```

The script handles:
- ACM certificate creation/validation in us-east-1 (for CloudFront/Cognito) and regional (for API Gateway)
- Google OAuth secret retrieval from AWS Secrets Manager
- CDK deploy with all context parameters
- Cognito custom domain configuration with DNS validation
- Lambda trigger wiring post-deployment

For a basic production deploy without custom domains:
```bash
cdk deploy --context environment=production --all --require-approval never
```

### Destroy Infrastructure

```bash
# Dev environment
cdk destroy --context environment=dev --all

# Production (requires confirmation)
cdk destroy --context environment=production --all
```

## Stack Outputs

After deployment, the unified stack exports these resource identifiers:

- `ApiUrl`: API Gateway endpoint URL (or custom domain api.bluefin605.com)
- `UserPoolId`: Cognito User Pool ID
- `WebClientId`: Cognito Web App Client ID
- `FrontendBucket`: Frontend S3 bucket name
- `DistributionId`: CloudFront distribution ID
- `FrontendUrl`: Full frontend URL (https://wiki.bluefin605.com or CloudFront domain)
- `CognitoDomain`: Cognito Hosted UI domain (auth.bluefin605.com or prefix domain)

## Cost Estimation

### Dev Environment (5 users, light usage)
- **S3**: < $0.50/month (1 GB storage + requests)
- **DynamoDB**: < $1.00/month (PAY_PER_REQUEST, < 1M requests)
- **Lambda**: < $0.50/month (< 100K invocations)
- **API Gateway**: < $1.00/month (< 1M requests)
- **CloudFront**: < $1.00/month (< 10 GB transfer)
- **Cognito**: Free (< 50K MAUs)
- **Secrets Manager**: $0.40/month (1 secret)
- **CloudWatch Logs**: < $0.50/month (< 5 GB logs)

**Total**: **< $5/month**

### Production Environment (20 users, moderate usage)
- **S3**: < $2.00/month (10 GB storage)
- **DynamoDB**: < $5.00/month (< 10M requests)
- **Lambda**: < $2.00/month (< 1M invocations)
- **API Gateway**: < $3.50/month (< 1M requests)
- **CloudFront**: < $5.00/month (< 50 GB transfer)
- **Cognito**: Free (< 50K MAUs)
- **Secrets Manager**: $0.40/month
- **CloudWatch Logs**: < $2.00/month

**Total**: **< $20/month**

## Differences from Aspire Local Development

| Aspect | Aspire (Local) | AWS CDK (Cloud) |
|--------|----------------|-----------------|
| **Backend** | Node.js services in containers | Lambda functions |
| **Database** | DynamoDB Local (LocalStack) | DynamoDB managed service |
| **Storage** | LocalStack S3 | S3 production buckets |
| **Frontend** | Vite dev server (localhost:5173) | CloudFront + S3 static hosting |
| **API** | Direct HTTP calls | API Gateway REST API |
| **Secrets** | appsettings.json | AWS Secrets Manager |
| **Observability** | Aspire Dashboard | CloudWatch Logs + X-Ray |
| **Email** | MailHog SMTP container | AWS SES |

## Next Steps

1. ✅ **Phase 1.3 Complete**: Infrastructure code created
2. **Phase 1.4**: Deploy dev environment: `cdk deploy --context environment=dev --all`
3. **Phase 2+**: Implement Lambda functions and update ComputeStack with actual handlers

## Troubleshooting

### Error: "Cyclic reference detected"
- **Fixed**: FrontendBucket moved to CDN stack to avoid circular dependency with OAI

### Error: "Unable to assume IAM role"
- Ensure AWS CLI is configured: `aws configure`
- Verify credentials: `aws sts get-caller-identity`

### Error: "Stack already exists"
- Update existing stack: `cdk deploy --context environment=dev`
- Or destroy and recreate: `cdk destroy && cdk deploy`

## Additional Resources

- [AWS CDK C# Documentation](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-csharp.html)
- [AWS CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
- [BlueFinWiki Technical Plan](../TECHNICAL-PLAN.md)
- [BlueFinWiki Tasks](../TASKS.md)

---

**Last Updated**: March 16, 2026
**CDK Version**: 2.x
**.NET Version**: 8.0
