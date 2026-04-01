using Aspire.Hosting;
using Aspire.Hosting.JavaScript;

var builder = DistributedApplication.CreateBuilder(args);

// LocalStack for AWS service emulation (S3, DynamoDB, SES)
var localstack = builder.AddContainer("localstack", "localstack/localstack", "latest")
    .WithEnvironment("SERVICES", "s3,dynamodb,ses")
    .WithEnvironment("DEBUG", "1")
    .WithEnvironment("EDGE_PORT", "4566")
    .WithEnvironment("LOCALSTACK_ACKNOWLEDGE_ACCOUNT_REQUIREMENT", "1")
    .WithHttpEndpoint(port: 4566, targetPort: 4566, name: "localstack")
    .WithHttpHealthCheck("/_localstack/health", endpointName: "localstack");

// Cognito Local for local authentication testing
var cognitoLocal = builder.AddContainer("cognito-local", "jagregory/cognito-local", "latest")
    .WithHttpEndpoint(port: 9229, targetPort: 9229, name: "cognito-local")
    .WithBindMount("./cognito-local-data", "/app/.cognito");

// MailHog for SMTP email testing
var mailhog = builder.AddContainer("mailhog", "mailhog/mailhog", "latest")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "mailhog-ui")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "mailhog-smtp");

// Backend API (Node.js Express wrapper for Lambda functions)
var backend = builder.AddJavaScriptApp("backend", "../../backend", "dev")
    .WaitFor(localstack)
    .WaitFor(cognitoLocal)
    .WithEnvironment("NODE_ENV", "development")
    .WithEnvironment("PORT", "3000")
    .WithEnvironment("AWS_REGION", "us-east-1")
    .WithEnvironment("AWS_ACCESS_KEY_ID", "test")
    .WithEnvironment("AWS_SECRET_ACCESS_KEY", "test")
    .WithEnvironment("AWS_ENDPOINT_URL", "http://localhost:4566")
    .WithEnvironment("COGNITO_USER_POOL_ID", "local_abc123")
    .WithEnvironment("COGNITO_CLIENT_ID", "local-client-id")
    .WithEnvironment("COGNITO_REGION", "us-east-1")
    .WithEnvironment("COGNITO_ENDPOINT", "http://localhost:9229")
    .WithEnvironment("S3_PAGES_BUCKET", "bluefinwiki-pages-local")
    .WithEnvironment("S3_EXPORTS_BUCKET", "bluefinwiki-exports-local")
    .WithEnvironment("USER_PROFILES_TABLE", "bluefinwiki-user-profiles-local")
    .WithEnvironment("DYNAMODB_INVITATIONS_TABLE", "bluefinwiki-invitations-local")
    .WithEnvironment("DYNAMODB_COMMENTS_TABLE", "bluefinwiki-comments-local")
    .WithEnvironment("DYNAMODB_PAGE_LINKS_TABLE", "bluefinwiki-page-links-local")
    .WithEnvironment("DYNAMODB_ACTIVITY_LOG_TABLE", "bluefinwiki-activity-log-local")
    .WithEnvironment("DYNAMODB_PAGE_INDEX_TABLE", "bluefinwiki-page-index-local")
    .WithEnvironment("DYNAMODB_SITE_CONFIG_TABLE", "bluefinwiki-site-config-local")
    .WithEnvironment("FRONTEND_URL", "http://localhost:5173")
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WithExternalHttpEndpoints();

// Frontend (Vite/React)
var frontend = builder.AddViteApp("frontend", "../../frontend")
    .WithEnvironment("NODE_ENV", "development")
    .WithEnvironment("VITE_DISABLE_AUTH", "true")
    .WithEnvironment("VITE_API_BASE_URL", "http://localhost:3000")
    .WithEnvironment("VITE_ALLOW_LOCAL_API_IN_PROD", "true")
    .WithEnvironment("VITE_AWS_REGION", "us-east-1")
    .WithEnvironment("VITE_COGNITO_USER_POOL_ID", "local_abc123")
    .WithEnvironment("VITE_COGNITO_CLIENT_ID", "local-client-id")
    .WithEnvironment("VITE_COGNITO_ENDPOINT", "http://localhost:9229")
    .WithEnvironment("VITE_LOCALSTACK_ENDPOINT", "http://localhost:4566")
    .WithExternalHttpEndpoints();

var app = builder.Build();
await app.RunAsync();
