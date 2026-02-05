var builder = DistributedApplication.CreateBuilder(args);

// LocalStack for AWS service emulation (S3, DynamoDB, SES)
var localstack = builder.AddContainer("localstack", "localstack/localstack", "latest")
    .WithEnvironment("SERVICES", "s3,dynamodb,ses")
    .WithEnvironment("DEBUG", "1")
    .WithEnvironment("EDGE_PORT", "4566")
    .WithEnvironment("DATA_DIR", "/tmp/localstack/data")
    .WithEnvironment("PERSISTENCE", "1")
    .WithHttpEndpoint(port: 4566, targetPort: 4566, name: "localstack")
    .WithBindMount("./localstack-data", "/tmp/localstack/data");

// MailHog for SMTP email testing
var mailhog = builder.AddContainer("mailhog", "mailhog/mailhog", "latest")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "mailhog-ui")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "mailhog-smtp");

// Backend (Lambda functions running locally as Node.js service)
var backend = builder.AddNodeApp("backend", "../../backend")
    .WithEnvironment("NODE_ENV", "development")
    .WithEnvironment("PORT", "3000")
    .WithEnvironment("AWS_ENDPOINT", localstack.GetEndpoint("localstack"))
    .WithEnvironment("AWS_REGION", "us-east-1")
    .WithEnvironment("AWS_ACCESS_KEY_ID", "test")
    .WithEnvironment("AWS_SECRET_ACCESS_KEY", "test")
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
    .WithEnvironment("SMTP_HOST", "localhost")
    .WithEnvironment("SMTP_PORT", "1025")
    .WithEnvironment("JWT_SECRET", "local-dev-secret-change-in-production")
    .WithEnvironment("JWT_EXPIRY", "30d")
    .WithEnvironment("OTEL_SERVICE_NAME", "bluefinwiki-backend")
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
    .WithHttpEndpoint(port: 3000, targetPort: 3000, name: "backend-api")
    .WithReference(localstack)
    .WithReference(mailhog)
    .WaitFor(localstack)
    .WaitFor(mailhog);

// Frontend (Vite dev server)
var frontend = builder.AddNpmApp("frontend", "../../frontend")
    .WithEnvironment("NODE_ENV", "development")
    .WithEnvironment("VITE_API_URL", "http://localhost:3000")
    .WithEnvironment("VITE_APP_NAME", "BlueFinWiki")
    .WithEnvironment("VITE_ENVIRONMENT", "local")
    .WithHttpEndpoint(port: 5173, targetPort: 5173, name: "frontend-web")
    .WithReference(backend)
    .WaitFor(backend);

builder.Build().Run();
