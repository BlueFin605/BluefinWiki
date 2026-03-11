# GitHub Environments Setup Guide

This guide explains how to set up GitHub environment protection rules for safe deployments of BlueFinWiki to dev, staging, and production environments.

## Overview

GitHub Environments allow you to define deployment rules per environment. The `deploy-frontend.yml` workflow uses these environments to ensure proper controls are in place before deploying code.

## Why Environment Protection Rules Matter

- **Prevents accidental production deploys** - Require approvals before live deployments
- **Enforces code quality** - Ensure tests pass before any deployment
- **Audit trail** - Track who approved what deployment and when
- **Branch protection** - Limit which branches can deploy to which environments
- **Secrets isolation** - Each environment can have separate AWS credentials

## Setup Instructions

### Step 1: Navigate to GitHub Environment Settings

1. Go to your repository: **BlueFinWiki**
2. Click **Settings** (top-right gear icon)
3. In the left sidebar, click **Environments**
4. You'll see a page to create/manage environments

### Step 2: Create the Three Environments

You need to create three environments: `dev`, `staging`, and `production`

#### Create `dev` Environment

1. Click **New environment**
2. Name: `dev`
3. Click **Configure environment**
4. Under "Environment protection rules":
   - **Deployment branches and tags**: Select "Protected branches only"
   - **Choose environments**: Select `main` branch
5. **Secrets** (optional for now):
   - You can keep using your root repository secrets, or add environment-specific ones
6. Click **Save protection rules**

**Recommended Settings for Dev:**
- ✅ Deployment branches: `main`
- ❌ Required approvers: Not required
- ❌ Restrict who can deploy: Not required
- ✅ Allow concurrency: Yes (can deploy multiple times)

---

#### Create `staging` Environment

1. Click **New environment**
2. Name: `staging`
3. Click **Configure environment**
4. Under "Environment protection rules":
   - **Deployment branches and tags**: Select "Protected branches only"
   - **Choose environments**: Select `develop` branch
   - **Required reviewers**: (Optional) Add team members who should approve staging deployments
   - **Restrict who can deploy to this environment**: (Optional) Limit to specific teams

5. Click **Save protection rules**

**Recommended Settings for Staging:**
- ✅ Deployment branches: `develop`
- ❌ Required approvers: Not required (optional: add 1 reviewer for larger teams)
- ❌ Restrict who can deploy: Not required
- ✅ Allow concurrency: Yes

---

#### Create `production` Environment

1. Click **New environment**
2. Name: `production`
3. Click **Configure environment**
4. Under "Environment protection rules":
   - **Deployment branches and tags**: Select "Protected branches only"
   - **Choose environments**: Select `master` branch
   - **Required reviewers**: ✅ **RECOMMENDED** - Add 1-2 senior developers
   - **Restrict who can deploy to this environment**: ✅ **RECOMMENDED** - Limit to release team/leads

5. Click **Save protection rules**

**Recommended Settings for Production:**
- ✅ Deployment branches: `master` only
- ✅ Required approvers: 1-2 people (team leads)
- ✅ Restrict who can deploy: Limit to release team
- ❌ Allow concurrency: No (prevent simultaneous deployments)

### Step 3: Configure Secrets Per Environment

Each environment can have its own AWS credentials (optional but recommended for security).

#### For Each Environment:

1. In the Environment page, scroll to **Secrets**
2. Click **Add secret** if you want environment-specific credentials
3. Add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

**Note**: If not defined per-environment, the workflow will use repository-level secrets.

### Step 4: Verify Your Branch Protection Rules

Ensure your main branches have appropriate protections:

1. Go to **Settings → Branches**
2. Click **Add rule** for each protected branch:

**For `main` branch:**
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

**For `develop` branch:**
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging

**For `master` branch (production):**
- ✅ Require pull request reviews (2+ approvals)
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Require code review from code owners (if using CODEOWNERS)
- ✅ Dismiss stale pull request approvals
- ✅ Require approval of the latest reviewable commit

## Workflow Integration

Your `deploy-frontend.yml` workflow automatically uses these environments:

```yaml
environment:
  name: ${{ inputs.environment || (github.ref == 'refs/heads/master' && 'production') || (github.ref == 'refs/heads/develop' && 'staging') || 'dev' }}
```

This means:
- **Pushing to `main`** → Deploys to `dev` environment
- **Pushing to `develop`** → Deploys to `staging` environment
- **Pushing to `master`** → Deploys to `production` environment (requires approval if configured)
- **Manual trigger** → You choose the environment

## Testing the Setup

### Test Dev Deployment

```bash
# Create a feature branch and push
git checkout -b feature/test-deploy
git commit --allow-empty -m "test deploy"
git push origin main
```

This should trigger automatic deployment to dev without requiring approval.

### Test Production Deployment Requirements

1. Create a pull request to merge `develop` → `master`
2. Ensure all checks pass
3. Merge to `master`
4. The workflow will start but wait for approval in the Actions tab
5. Go to **Actions → Deploy Frontend → [Latest run]**
6. Click **Review deployments**
7. Select `production` environment
8. Add a comment (optional)
9. Approve or reject

## Security Best Practices

### 1. Use Branch Protection Rules
- Require pull request reviews before merging
- Require status checks to pass
- Dismiss stale PR approvals
- Require up-to-date branches

### 2. Separate Credentials Per Environment

Avoid reusing production AWS credentials for dev. Create:
- **Dev AWS user**: Limited permissions for development
- **Staging AWS user**: Limited permissions for staging tests
- **Production AWS user**: Minimal permissions, restricted access

Add each as environment secrets in GitHub.

### 3. Limit Deployment Approval Authority

```
dev: Everyone can approve (or no approval needed)
staging: Team leads can approve
production: Only release managers / senior leads can approve
```

### 4. Use CODEOWNERS for Production

Create `.github/CODEOWNERS`:

```bash
* @owner1 @owner2

# Production deployments require specific team approval
/frontend/ @team-frontend
```

### 5. Audit Deployment Logs

Regularly check:
1. **Actions tab** → See all deployment runs
2. **Deployments** → View deployment history
3. **Environment details** → Check who approved what

## Troubleshooting

### Workflow Stuck on "Waiting for Review"

**Solution**: 
1. Go to **Settings → Environments → [environment name]**
2. Check **Required reviewers** - Ensure the user who triggered the deployment isn't the only reviewer
3. Production deployments need approval from a different user

### Secrets Not Found in Workflow

**Solution**:
1. Verify secrets are added to the environment (not just repository-level)
2. Use environment-specific secrets in workflow if needed:
   ```yaml
   env:
     AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
   ```

### Wrong Branch Deploying to Wrong Environment

**Solution**:
1. Check branch names match exactly: `main`, `develop`, `master`
2. Verify workflow logic in `deploy-frontend.yml`:
   ```yaml
   inputs.environment || (github.ref == 'refs/heads/master' && 'production')
   ```

### Frontend Auth Env Validation Failed

**Problem**: Deploy fails at `Validate frontend auth env values` with an invalid/missing `VITE_*` value.

**Why this happens**:
- The deploy workflow now validates frontend auth build values before `npm run build`
- Values are pulled from CloudFormation outputs on `BlueFinWiki-production`
- Placeholder/local values are rejected (for example `local-client-id`, `local_abc123`)

**Solution**:
1. Verify stack outputs exist and are non-empty:
   - `ApiUrl`
   - `UserPoolId`
   - `WebClientId`
2. Confirm Cognito app client exists in the target AWS region and matches `WebClientId`
3. Re-run the deploy workflow after fixing stack outputs or Cognito configuration

### Production Approval Won't Appear

**Problem**: User doesn't have permission to approve
**Solution**:
1. Go to **Settings → Environments → production**
2. Under **Restrict who can deploy**, add the user's team
3. Ensure the user is a repo collaborator or team member

## Recommended Environment Configuration Summary

| Setting | Dev | Staging | Production |
|---------|-----|---------|------------|
| **Branch** | `main` | `develop` | `master` |
| **Approval Required** | ❌ | ❌ (optional) | ✅ (1-2 people) |
| **Deployment Restrictions** | None | Optional | Team leads only |
| **Secrets Isolation** | Shared | Optional | Separate AWS account |
| **Concurrent Deployments** | ✅ Yes | ✅ Yes | ❌ No |
| **Auto-deploy on push** | ✅ Yes | ✅ Yes | ❌ Wait for approval |

## Next Steps

1. **Create the three environments** following Step 2 above
2. **Add required approvers** to production environment
3. **Test the workflow** by pushing to each branch
4. **Monitor Actions tab** to ensure deployments work as expected
5. **Document your approval process** for team members

---

For more information, see [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
