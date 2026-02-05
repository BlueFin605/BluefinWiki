# BlueFinWiki - Deployment Guide

## Quick Start: Deploy to AWS

### 1. Prerequisites

Ensure you have:
- ✅ .NET 8.0 SDK installed
- ✅ AWS CDK CLI installed: `npm install -g aws-cdk`
- ✅ AWS CLI configured with your credentials

### 2. Bootstrap CDK (First Time Only)

```powershell
# Navigate to infrastructure directory
cd infrastructure

# Bootstrap your AWS account/region for CDK
cdk bootstrap
```

### 3. Deploy Dev Environment

```powershell
# Synthesize CloudFormation templates to verify
cdk synth --context environment=dev --all

# Deploy all stacks to dev environment
cdk deploy --context environment=dev --all
```

Expected deployment order:
1. `BlueFinWiki-dev-Storage` (S3 buckets)
2. `BlueFinWiki-dev-Database` (DynamoDB tables)
3. `BlueFinWiki-dev-Compute` (Lambda + API Gateway)
4. `BlueFinWiki-dev-CDN` (CloudFront + Frontend bucket)

**Deployment time**: ~15-20 minutes (CloudFront takes longest)

### 4. View Stack Outputs

```powershell
# Get API URL
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev-Compute --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# Get Frontend URL
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev-CDN --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text
```

## Environment-Specific Deployments

### Dev Environment
```powershell
cdk deploy --context environment=dev --all
```

### Staging Environment
```powershell
cdk deploy --context environment=staging --all
```

### Production Environment
```powershell
cdk deploy --context environment=production --all --require-approval never
```

## Deploy Individual Stacks

If you need to update a specific stack:

```powershell
# Update only storage
cdk deploy BlueFinWiki-dev-Storage --context environment=dev

# Update only database
cdk deploy BlueFinWiki-dev-Database --context environment=dev

# Update compute (Lambda functions)
cdk deploy BlueFinWiki-dev-Compute --context environment=dev

# Update CDN
cdk deploy BlueFinWiki-dev-CDN --context environment=dev
```

## Diff Before Deploying

Preview changes before deployment:

```powershell
cdk diff --context environment=dev
```

## Destroy Infrastructure

To tear down the dev environment:

```powershell
# WARNING: This will delete all data!
cdk destroy --context environment=dev --all
```

## Troubleshooting

### Issue: "CDK is not bootstrapped"
**Solution**: Run `cdk bootstrap` first

### Issue: "Stack already exists"
**Solution**: Update the stack with `cdk deploy`

### Issue: "Insufficient permissions"
**Solution**: Ensure your AWS credentials have AdministratorAccess or equivalent permissions for:
- S3
- DynamoDB
- Lambda
- API Gateway
- CloudFront
- IAM
- Secrets Manager

### Issue: "Rate exceeded"
**Solution**: CloudFormation API throttling - wait a minute and retry

## Next Steps After Deployment

1. **Verify Resources**: Check AWS Console for created resources
2. **Test API**: `curl <API_URL>` (should return placeholder response)
3. **Upload Frontend**: Deploy React app to Frontend S3 bucket
4. **Configure DNS**: Point custom domain to CloudFront distribution
5. **Implement Lambda Functions**: Update ComputeStack with actual Lambda handlers

## Cost Monitoring

View current month's costs:
```powershell
aws ce get-cost-and-usage --time-period Start=2026-02-01,End=2026-02-28 --granularity MONTHLY --metrics UnblendedCost
```

Set up billing alerts in AWS Console → Billing → Budgets.

---

**For local development**, see [ASPIRE-SETUP.md](../aspire/ASPIRE-SETUP.md)  
**For infrastructure details**, see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)
