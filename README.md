# BlueFinWiki

**Family Wiki Platform** - A serverless, AWS-based wiki system designed for families (3-20 users)

## 🌟 Features

- **Invite-only Authentication** - Secure, family-only access
- **S3-based Storage** - GUID-based file system with versioning
- **Markdown Editor** - Rich text editing with live preview
- **Full-text Search** - Fast search across all pages
- **Mobile-responsive** - Works on all devices
- **Zero-knowledge Deployment** - Infrastructure as Code

## 🏗️ Architecture

BlueFinWiki is a monorepo containing four main packages:

- **frontend** - React 18 + TypeScript + Vite + Tailwind CSS
- **backend** - AWS Lambda functions (Node.js 20)
- **infrastructure** - AWS CDK (C#)
- **aspire** - Microsoft Aspire for local development orchestration

### Tech Stack

#### Production
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Query
- **Backend**: AWS Lambda, Node.js 20, TypeScript
- **Database**: AWS DynamoDB
- **Storage**: AWS S3
- **Search**: AWS CloudSearch / OpenSearch Serverless
- **CDN**: AWS CloudFront
- **IaC**: AWS CDK (C#)

#### Local Development
- **Orchestration**: Microsoft Aspire (.NET 8)
- **AWS Emulation**: LocalStack (S3, DynamoDB, SES)
- **Email Testing**: MailHog
- **Observability**: Aspire Dashboard (OpenTelemetry)

## 📋 Prerequisites

### For Local Development
- **.NET 8.0 SDK** or later
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker Desktop** (for LocalStack)
- **Git** for version control

### For Cloud Deployment
- **AWS Account** with CLI configured
- **AWS CDK** installed globally

## 🚀 Getting Started

### Quick Start (3 Steps)

1. **First-Time Setup** (one time only):
   ```powershell
   .\setup-aspire.ps1
   ```

2. **Start Development**:
   ```powershell
   dotnet run --project aspire/BlueFinWiki.AppHost
   ```

3. **Open Your Browser**:
   - Frontend: http://localhost:5173
   - Aspire Dashboard: http://localhost:15888

📖 **See [QUICKSTART.md](QUICKSTART.md) for detailed quick start guide**

---

### Detailed Setup

#### Option 1: Automated Setup (Recommended)

Run the setup script from the project root:

```powershell
.\setup-aspire.ps1
```

This will:
- ✅ Install .NET Aspire workload
- ✅ Verify Docker Desktop is running
- ✅ Build the Aspire AppHost
- ✅ Install Node.js dependencies

Then start development:

```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

#### Option 2: Manual Setup

##### 1. Clone and Install

```bash
git clone https://github.com/your-org/bluefinwiki.git
cd bluefinwiki
```

##### 2. Install .NET and Aspire

```bash
# Install .NET 8.0 SDK from https://dotnet.microsoft.com/download
# Then install Aspire workload
dotnet workload install aspire
```

##### 3. Start Docker Desktop

Ensure Docker Desktop is running (required for LocalStack and MailHog).

##### 4. Install Node.js Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

##### 5. Run with Aspire
dotnet run --project aspire/BlueFinWiki.AppHost
```

This single command starts:
- Frontend (http://localhost:5173)
- Backend (http://localhost:3000)
- LocalStack (AWS services emulation)
- MailHog (email testing at http://localhost:8025)
- Aspire Dashboard (http://localhost:15888)

See [ASPIRE-SETUP.md](ASPIRE-SETUP.md) for detailed configuration.

### Option 2: Manual Development Setup

If you prefer not to use Aspire:

#### 1. Install Dependencies

```bash
# Install root dependencies and all workspace dependencies
npm install

# Or install individually
npm install --workspace=frontend
npm install --workspace=backend
npm install --workspace=infrastructure
```

#### 2. Set Up Git Hooks

```bash
# Initialize Husky for pre-commit hooks
npm run prepare
```

#### 3. Start LocalStack (Optional)

```bash
docker run -d \
  -p 4566:4566 \
  -p 4571:4571 \
  -e SERVICES=s3,dynamodb,ses \
  localstack/localstack
```

#### 4. Run Services Manually

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Option 3: Deploy to AWS

#### 1. Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

#### 2. Deploy Infrastructure (Dev Environment)

```bash
cd infrastructure
npm run deploy:dev
```

#### 3. Run Frontend Locally

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

## 🧪 Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace=frontend
npm test --workspace=backend
```

### Linting and Type Checking

```bash
# Lint all workspaces
npm run lint

# Type check all workspaces
npm run type-check
```

### Building for Production

```bash
# Build all workspaces
npm run build --workspaces

# Build specific workspace
npm run build --workspace=frontend
```

## 📦 Project Structure

```
bluefinwiki/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
│       ├── frontend.yml
│       ├── backend.yml
│       ├── infrastructure.yml
│       └── deploy-dev.yml
├── .husky/
│   └── pre-commit          # Git hooks
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   └── index.ts        # Lambda functions
│   ├── package.json
│   └── tsconfig.json
├── infrastructure/
│   ├── bin/
│   │   └── bluefinwiki.ts  # CDK app entry point
│   ├── lib/
│   │   └── bluefinwiki-stack.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
├── package.json            # Root workspace config
├── .gitignore
├── .lintstagedrc.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create `.env` files in each workspace:

**frontend/.env**
```env
VITE_API_URL=https://your-api.execute-api.us-east-1.amazonaws.com
```

**backend/.env**
```env
AWS_REGION=us-east-1
DYNAMODB_TABLE_PREFIX=bluefinwiki-dev
S3_BUCKET_PREFIX=bluefinwiki-dev
```

### AWS CDK Context

Configure environments in `infrastructure/cdk.json`:

```json
{
  "context": {
    "dev": {
      "account": "123456789012",
      "region": "us-east-1"
    }
  }
}
```

## 🚢 Deployment

### Deploy to Development

```bash
cd infrastructure
npm run deploy:dev
```

### Deploy to Staging

```bash
cd infrastructure
npm run deploy:staging
```

### Deploy to Production

```bash
cd infrastructure
npm run deploy:prod
```

### CI/CD Pipeline

Commits to `main` branch automatically deploy to the dev environment via GitHub Actions.

## 🧪 Testing Strategy

- **Unit Tests**: Vitest for both frontend and backend
- **Integration Tests**: Vitest + MSW (Mock Service Worker)
- **E2E Tests**: Playwright (to be implemented)

## 📚 Documentation

Detailed specifications and implementation plans:

- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - Feature specifications
- [TECHNICAL-PLAN.md](./TECHNICAL-PLAN.md) - Technical implementation details
- [TASKS.md](./TASKS.md) - Implementation tasks and timeline
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contributing guidelines

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

Private - Family Use Only

## 🐛 Issues and Support

For issues, questions, or feature requests, please create an issue in the GitHub repository.

## 🗓️ Project Status

- **Current Phase**: Phase 1 - Foundation (Weeks 1-3)
- **Status**: In Development
- **Target MVP**: Week 12
- **Target Launch**: Week 16

## 📊 Cost Estimation

Expected AWS costs for typical family usage:
- **S3 Storage**: $0.50-1.00/month
- **DynamoDB**: $0.50-1.00/month
- **Lambda**: $0.20-0.50/month
- **CloudFront**: $0.50-1.00/month
- **CloudSearch**: $2.00-3.00/month

**Total**: ~$5/month for 5-user family with 500 pages

## 👥 Team

- 2-3 developers
- 12-16 week timeline
- Agile methodology with 2-week sprints
