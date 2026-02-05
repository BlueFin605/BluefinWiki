# BlueFinWiki Infrastructure - AWS CDK (C#)

## Overview

This directory contains the AWS CDK C# infrastructure code for BlueFinWiki. The infrastructure is organized into four CloudFormation stacks for better modularity and deployment control.

## Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download)
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html): `npm install -g aws-cdk`
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
- AWS Account with appropriate permissions

## Project Structure

```
infrastructure/
├── cdk.json                  # CDK app configuration
├── README.md                 # This file
└── src/
    └── Infrastructure/
        ├── Program.cs        # CDK app entry point with environment configuration
        ├── Infrastructure.csproj
        └── Stacks/
            ├── StorageStack.cs    # S3 buckets for pages, attachments, exports
            ├── DatabaseStack.cs   # DynamoDB tables
            ├── ComputeStack.cs    # Lambda functions and API Gateway
            └── CdnStack.cs        # CloudFront distribution and frontend bucket
```

## Stacks Overview

### 1. **Storage Stack** (`BlueFinWiki-{env}-Storage`)
S3 buckets for application data:
- **Pages Bucket**: Wiki page content and metadata (JSON format, versioned)
- **Attachments Bucket**: Uploaded files (images, PDFs, etc.)
- **Exports Bucket**: Generated PDFs and HTML exports (7-day auto-cleanup)

### 2. **Database Stack** (`BlueFinWiki-{env}-Database`)
DynamoDB tables for metadata and user data:
- **Users**: Authentication and user profiles (GSI: email-index)
- **Invitations**: Invite codes with TTL
- **Page Links**: Internal wiki links and backlinks (GSI: targetGuid-index)
- **Attachments**: File metadata (GSI: pageGuid-index)
- **Comments**: Page discussions (GSI: pageGuid-createdAt-index)
- **Activity Log**: Audit trail with TTL
- **User Preferences**: Dashboard customization, favorites
- **Site Config**: Global wiki settings

### 3. **Compute Stack** (`BlueFinWiki-{env}-Compute`)
Serverless compute resources:
- **API Gateway REST API**: Public API endpoints
- **Lambda Functions**: Backend logic (placeholder during phase 1)
- **Secrets Manager**: JWT signing secret
- **IAM Roles**: Lambda execution roles with least privilege

### 4. **CDN Stack** (`BlueFinWiki-{env}-CDN`)
Content delivery and frontend hosting:
- **Frontend S3 Bucket**: React SPA static files
- **CloudFront Distribution**: Global CDN with caching policies
- **Origin Access Identity**: Secure S3 access

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

#### Deploy All Stacks (Dev Environment)

```bash
cdk deploy --context environment=dev --all
```

#### Deploy Individual Stacks

```bash
# Storage stack only
cdk deploy BlueFinWiki-dev-Storage --context environment=dev

# Database stack only
cdk deploy BlueFinWiki-dev-Database --context environment=dev

# All at once with specific order
cdk deploy BlueFinWiki-dev-Storage BlueFinWiki-dev-Database BlueFinWiki-dev-Compute BlueFinWiki-dev-CDN --context environment=dev
```

#### Deploy to Production

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

After deployment, important resource identifiers are exported:

### Storage Stack
- `{env}-pages-bucket`: Pages S3 bucket name
- `{env}-attachments-bucket`: Attachments S3 bucket name
- `{env}-exports-bucket`: Exports S3 bucket name

### Database Stack
- `{env}-users-table`: Users DynamoDB table name
- `{env}-page-links-table`: Page links DynamoDB table name

### Compute Stack
- `{env}-api-url`: API Gateway endpoint URL
- `{env}-api-id`: API Gateway ID
- `{env}-jwt-secret-arn`: Secrets Manager ARN for JWT secret

### CDN Stack
- `{env}-frontend-bucket`: Frontend S3 bucket name
- `{env}-distribution-id`: CloudFront distribution ID
- `{env}-distribution-domain`: CloudFront domain name
- `{env}-frontend-url`: Full frontend URL (https://...)

## Cost Estimation

### Dev Environment (5 users, light usage)
- **S3**: < $0.50/month (1 GB storage + requests)
- **DynamoDB**: < $1.00/month (PAY_PER_REQUEST, < 1M requests)
- **Lambda**: < $0.50/month (< 100K invocations)
- **API Gateway**: < $1.00/month (< 1M requests)
- **CloudFront**: < $1.00/month (< 10 GB transfer)
- **Secrets Manager**: $0.40/month (1 secret)
- **CloudWatch Logs**: < $0.50/month (< 5 GB logs)

**Total**: **< $5/month**

### Production Environment (20 users, moderate usage)
- **S3**: < $2.00/month (10 GB storage)
- **DynamoDB**: < $5.00/month (< 10M requests)
- **Lambda**: < $2.00/month (< 1M invocations)
- **API Gateway**: < $3.50/month (< 1M requests)
- **CloudFront**: < $5.00/month (< 50 GB transfer)
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

**Last Updated**: February 6, 2026  
**CDK Version**: 2.x  
**.NET Version**: 8.0
