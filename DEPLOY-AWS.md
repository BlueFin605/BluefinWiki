# BlueFinWiki - Deploy to AWS

Get your own family wiki running on AWS. This guide walks you through provisioning all infrastructure with AWS CDK (C#) and deploying the application.

**Deployment time**: ~15-20 minutes (CloudFront distribution takes the longest)

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [Node.js 20+](https://nodejs.org/) | Build backend and frontend | `nvm install 20` or download |
| [.NET 8.0 SDK](https://dotnet.microsoft.com/download) | CDK infrastructure (C#) | Download from Microsoft |
| [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) | Deploy infrastructure | `npm install -g aws-cdk` |
| [AWS CLI](https://aws.amazon.com/cli/) | AWS access and post-deploy commands | Download from AWS |

Your AWS CLI must be configured with credentials that have permissions for S3, DynamoDB, Lambda, API Gateway, CloudFront, Cognito, IAM, Secrets Manager, ACM, and CloudFormation. AdministratorAccess works but is broader than necessary.

## Step 1: Build the Application

CDK deploys pre-built code, so you must build both the backend and frontend first.

```bash
# Install dependencies (from repo root)
npm install
cd frontend && npm install && cd ..

# Build the backend (Lambda handlers)
cd backend
npm run build
cd ..

# Build the frontend (React SPA)
cd frontend
npm run build
cd ..
```

The backend builds to `backend/dist/` (TypeScript compiled to JS). The frontend builds to `frontend/dist/` (static files for S3/CloudFront).

## Step 2: Configure

Copy `config.example.json` to `config.json` in the repo root:

```bash
cp config.example.json config.json
```

Edit `config.json` with your settings:

```json
{
  "bluefinwiki": {
    "prefix": "familywiki",
    "region": "us-east-1",
    "environment": "production",
    "domain": "",
    "certificateArnUsEast1": "",
    "certificateArnRegional": "",
    "enableCognitoCustomDomain": false,
    "enableGoogleLogin": false
  }
}
```

### Configuration Reference

| Field | Default | Description |
|-------|---------|-------------|
| `prefix` | `bluefinwiki` | **Resource naming prefix.** All AWS resources are named `{prefix}-{resource}-{environment}`. Change this to something unique to you (e.g. `familywiki`, `smithwiki`). Must be lowercase, no spaces. |
| `region` | `ap-southeast-2` | **AWS region** for all resources. Pick the region closest to your users. |
| `environment` | `production` | `dev`, `staging`, or `production`. Controls backup, log retention, and removal policies (see Environment Differences below). |
| `domain` | _(empty)_ | Custom domain for your wiki (e.g. `wiki.yourdomain.com`). Leave empty to use the auto-generated CloudFront URL. |
| `certificateArnUsEast1` | _(empty)_ | ACM certificate ARN in **us-east-1** (required by CloudFront). Only needed with a custom domain. |
| `certificateArnRegional` | _(empty)_ | ACM certificate ARN in your stack region (for API Gateway). Only needed with a custom domain. |
| `enableCognitoCustomDomain` | `false` | Use a custom Cognito auth domain instead of the auto-generated one. Only needed with a custom domain. |
| `enableGoogleLogin` | `false` | Enable Google social login. Requires a Google OAuth secret in Secrets Manager at `{prefix}/{environment}/google-oauth`. |

The `prefix` controls how all resources are named. For example, with `prefix: "familywiki"` and `environment: "dev"`:
- Stack: `familywiki-dev`
- S3 bucket: `familywiki-pages-dev`
- DynamoDB tables: `familywiki-user-profiles-dev`, `familywiki-page-index-dev`, etc.
- Lambda functions: `familywiki-dev-pages-create`, `familywiki-dev-pages-get`, etc.
- Cognito user pool: `familywiki-users-dev`

> **Note:** The JSON key `"bluefinwiki"` in config.json is always `"bluefinwiki"` regardless of your prefix — it identifies the config section, not your resources.

### Minimal Setup (Dev / No Custom Domain)

For a quick dev deployment, you only need to set `prefix`, `region`, and `environment` in your config. Everything else can stay empty or false — CDK will auto-generate CloudFront URLs and Cognito domains.

## Step 3: Deploy Infrastructure

```bash
cd infrastructure

# Bootstrap CDK (first time only per AWS account/region)
cdk bootstrap

# Preview what will be created
cdk diff --all

# Deploy everything
cdk deploy --all
```

CDK automatically reads `../config.json` (relative to the `infrastructure/` directory). Your `config.json` determines the environment, region, prefix, and all other settings. You can also point to a different config file:

```bash
cdk deploy --context configFile=/path/to/my-config.json --all
```

Or override individual values without a config file:

```bash
cdk deploy --context prefix=familywiki --context environment=dev --all
```

CDK creates a single CloudFormation stack (`BlueFinWiki-{environment}`) containing:

- **S3**: Pages bucket (Markdown content + attachments), frontend bucket (React SPA)
- **DynamoDB**: 7 tables — user profiles, invitations, page links, activity log, page index, tags, page types
- **Lambda**: Node.js 20 handlers for all API endpoints
- **API Gateway**: REST API routing to Lambda
- **CloudFront**: CDN distribution serving the frontend
- **Cognito**: User pool, app clients, optional Google identity provider
- **IAM**: Least-privilege execution roles for all Lambda functions

## Step 4: Deploy the Frontend

CDK creates the S3 bucket and CloudFront distribution, but you need to upload the built frontend files:

```bash
# Get the frontend bucket name
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text

# Upload frontend build
aws s3 sync frontend/dist/ s3://FRONTEND_BUCKET_NAME --delete

# Invalidate CloudFront cache
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text

aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

## Step 5: Get Your URLs

```bash
# Frontend URL
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text

# API URL
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# Cognito User Pool ID
aws cloudformation describe-stacks --stack-name BlueFinWiki-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
```

## Step 6: Create Your First Admin User

BlueFinWiki uses an invite-only registration system. Since there are no users yet, you need to bootstrap the first admin manually:

1. **Open the AWS Console** -> Cognito -> User Pools -> find `{prefix}-users-{environment}`
2. **Create a user** with their email and a temporary password
3. **Create a user profile** in DynamoDB so the app recognises them as an admin:

```bash
# Get the user's Cognito sub (their unique ID)
aws cognito-idp admin-get-user \
  --user-pool-id USER_POOL_ID \
  --username THE_EMAIL \
  --query "UserAttributes[?Name=='sub'].Value" --output text

# Create their profile in DynamoDB
aws dynamodb put-item \
  --table-name {prefix}-user-profiles-dev \
  --item '{
    "cognitoUserId": {"S": "THE_SUB_FROM_ABOVE"},
    "email": {"S": "THE_EMAIL"},
    "displayName": {"S": "Your Name"},
    "role": {"S": "Admin"},
    "status": {"S": "active"},
    "inviteCode": {"S": "BOOTSTRAP"},
    "createdAt": {"S": "2026-01-01T00:00:00.000Z"},
    "updatedAt": {"S": "2026-01-01T00:00:00.000Z"}
  }'
```

4. **Log in** at your frontend URL. You are now the admin.
5. **Invite others** from the admin panel — the invitation system handles all subsequent users.

## Environment Differences

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| S3 Versioning | Yes | Yes | Yes |
| DynamoDB Backups | No | Yes | Yes |
| Log Retention | 7 days | 14 days | 90 days |
| CloudFront Price Class | 100 (cheapest) | 100 | 200 (global) |
| Removal Policy | DESTROY | DESTROY | RETAIN |

## Custom Domain Setup (Production)

If you configured a custom domain, you also need to:

1. **Create ACM certificates** — one in `us-east-1` (for CloudFront) and one in your stack region (for API Gateway). Both must cover your domain.
2. **Configure DNS** — point your domain to the CloudFront distribution. CDK outputs the distribution domain name.
3. **Verify Cognito** — if `enableCognitoCustomDomain` is true, ensure the auth subdomain DNS is configured.

## Tear Down

```bash
# Reads config.json for prefix/environment, same as deploy
cdk destroy --all
```

Production tear-down deletes the CloudFormation stack but retains S3 buckets and DynamoDB tables. Delete those manually in the AWS Console if you want a clean removal.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "CDK is not bootstrapped" | Run `cdk bootstrap` |
| "Insufficient permissions" | Ensure AWS credentials have the required permissions (see Prerequisites) |
| `backend/dist` not found | Run `npm run build` in the `backend/` directory first |
| Frontend shows blank page | Check that you uploaded `frontend/dist/` to the frontend S3 bucket and invalidated CloudFront |
| Cognito Hosted UI not working | Verify callback URLs match your frontend URL in the Cognito console |
| Login works but API returns 401 | Check that the API URL in the frontend config matches the deployed API Gateway URL |
| Google login not working | Ensure the secret exists in Secrets Manager at `{prefix}/{environment}/google-oauth` and `enableGoogleLogin` is true |

## Cost Monitoring

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-04-30 \
  --granularity MONTHLY \
  --metrics UnblendedCost
```

Set up a billing alert in AWS Console -> Billing -> Budgets to avoid surprises.
