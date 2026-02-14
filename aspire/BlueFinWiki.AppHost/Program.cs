using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// LocalStack for AWS service emulation (S3, DynamoDB, SES)
var localstack = builder.AddContainer("localstack", "localstack/localstack", "latest")
    .WithEnvironment("SERVICES", "s3,dynamodb,ses")
    .WithEnvironment("DEBUG", "1")
    .WithEnvironment("EDGE_PORT", "4566")
    .WithHttpEndpoint(port: 4566, targetPort: 4566, name: "localstack");

// Cognito Local for local authentication testing
var cognitoLocal = builder.AddContainer("cognito-local", "jagregory/cognito-local", "latest")
    .WithHttpEndpoint(port: 9229, targetPort: 9229, name: "cognito-local")
    .WithBindMount("./cognito-local-data", "/app/.cognito");

// MailHog for SMTP email testing
var mailhog = builder.AddContainer("mailhog", "mailhog/mailhog", "latest")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "mailhog-ui")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "mailhog-smtp");

// Backend API (Node.js Express wrapper for Lambda functions)
var backend = builder.AddNpmApp("backend", "../../backend", "dev")
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
    .WithEnvironment("S3_ATTACHMENTS_BUCKET", "bluefinwiki-attachments-local")
    .WithEnvironment("S3_EXPORTS_BUCKET", "bluefinwiki-exports-local")
    .WithEnvironment("DYNAMODB_USERS_TABLE", "bluefinwiki-users-local")
    .WithEnvironment("DYNAMODB_INVITATIONS_TABLE", "bluefinwiki-invitations-local")
    .WithEnvironment("DYNAMODB_ATTACHMENTS_TABLE", "bluefinwiki-attachments-local")
    .WithEnvironment("DYNAMODB_COMMENTS_TABLE", "bluefinwiki-comments-local")
    .WithEnvironment("DYNAMODB_PAGE_LINKS_TABLE", "bluefinwiki-page-links-local")
    .WithEnvironment("DYNAMODB_ACTIVITY_LOG_TABLE", "bluefinwiki-activity-log-local")
    .WithEnvironment("DYNAMODB_SITE_CONFIG_TABLE", "bluefinwiki-site-config-local")
    .WithEnvironment("FRONTEND_URL", "http://localhost:5173")
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints();

// Frontend (Vite/React)
var frontend = builder.AddNpmApp("frontend", "../../frontend", "dev")
    .WithEnvironment("VITE_API_URL", "http://localhost:3000")
    .WithEnvironment("VITE_AWS_REGION", "us-east-1")
    .WithEnvironment("VITE_COGNITO_USER_POOL_ID", "local_abc123")
    .WithEnvironment("VITE_COGNITO_CLIENT_ID", "local-client-id")
    .WithEnvironment("VITE_COGNITO_ENDPOINT", "http://localhost:9229")
    .WithEnvironment("VITE_LOCALSTACK_ENDPOINT", "http://localhost:4566")
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints();

var app = builder.Build();
await app.RunAsync();
