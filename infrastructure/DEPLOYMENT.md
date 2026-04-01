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
# Synthesize CloudFormation template to verify
cdk synth --context environment=dev --all

# Deploy the unified stack to dev environment
cdk deploy --context environment=dev --all
```

The unified stack deploys all resources (S3, DynamoDB, Cognito, Lambda, API Gateway, CloudFront) in a single CloudFormation stack.

**Deployment time**: ~15-20 minutes (CloudFront takes longest)

### 4. View Stack Outputs

```powershell
# Get API URL
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# Get Frontend URL
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text

# Get Cognito User Pool ID
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
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

### Production Environment (with custom domains)

For production with custom domains, create a `config.json` from `config.example.json` in the repo root with your domain, certificate ARNs, and feature flags. Then deploy:

```powershell
cdk deploy --context environment=production --context configFile=../config.json --all --require-approval broadening
```

You can also pass individual context parameters:

```powershell
cdk deploy --context environment=production `
    --context domainName=wiki.yourdomain.com `
    --context certificateArnUsEast1=arn:aws:acm:us-east-1:... `
    --context certificateArnRegional=arn:aws:acm:ap-southeast-2:... `
    --context enableCognitoCustomDomain=true `
    --all --require-approval broadening
```

For a basic production deploy without custom domains:
```powershell
cdk deploy --context environment=production --all --require-approval never
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
- Cognito
- IAM
- Secrets Manager
- ACM (Certificate Manager)

### Issue: "Rate exceeded"
**Solution**: CloudFormation API throttling - wait a minute and retry

### Issue: Cognito Hosted UI not working after deploy
**Solution**: Ensure the deploy workflow's Cognito discovery step found the correct domain. Check:
- User Pool has a configured domain (prefix or custom)
- Web client has correct callback URLs (e.g., `https://wiki.yourdomain.com/callback`)
- Frontend env vars match the deployed Cognito configuration

### Issue: Google login not working
**Solution**: Ensure:
- Google OAuth client secret is in AWS Secrets Manager
- `enableGoogleLogin` context is set to `true`
- Cognito identity provider for Google is configured
- Pre-signup Lambda trigger is wired to the User Pool

## Next Steps After Deployment

1. **Verify Resources**: Check AWS Console for created resources
2. **Create First Admin**: Create initial admin user in Cognito console
3. **Test Login**: Navigate to the frontend URL and verify Cognito Hosted UI redirect
4. **Configure DNS**: Point custom domains to CloudFront (wiki), API Gateway (api), and Cognito (auth)
5. **CI/CD**: Configure GitHub environments per `GITHUB-ENVIRONMENTS-SETUP.md`

## Cost Monitoring

View current month's costs:
```powershell
aws ce get-cost-and-usage --time-period Start=2026-02-01,End=2026-02-28 --granularity MONTHLY --metrics UnblendedCost
```

Set up billing alerts in AWS Console → Billing → Budgets.

---

**For local development**, see [ASPIRE-SETUP.md](../aspire/ASPIRE-SETUP.md)  
**For infrastructure details**, see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)
