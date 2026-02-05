var builder = DistributedApplication.CreateBuilder(args);

// LocalStack for AWS service emulation (S3, DynamoDB, SES)
var localstack = builder.AddContainer("localstack", "localstack/localstack", "latest")
    .WithEnvironment("SERVICES", "s3,dynamodb,ses")
    .WithEnvironment("DEBUG", "1")
    .WithEnvironment("EDGE_PORT", "4566")
    .WithHttpEndpoint(port: 4566, targetPort: 4566, name: "localstack");

// MailHog for SMTP email testing
var mailhog = builder.AddContainer("mailhog", "mailhog/mailhog", "latest")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "mailhog-ui")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "mailhog-smtp");

// Backend (Lambda functions running locally as Node.js service)
var backend = builder.AddNodeApp("backend", "../../backend")
    .WithEnvironment("AWS_ENDPOINT", localstack.GetEndpoint("localstack"))
    .WithEnvironment("AWS_REGION", "us-east-1")
    .WithEnvironment("AWS_ACCESS_KEY_ID", "test")
    .WithEnvironment("AWS_SECRET_ACCESS_KEY", "test")
    .WithEnvironment("SMTP_HOST", "localhost")
    .WithEnvironment("SMTP_PORT", "1025")
    .WithHttpEndpoint(port: 3000, targetPort: 3000, name: "backend-api")
    .WithReference(localstack)
    .WithReference(mailhog);

// Frontend (Vite dev server)
var frontend = builder.AddNpmApp("frontend", "../../frontend")
    .WithEnvironment("VITE_API_URL", backend.GetEndpoint("backend-api"))
    .WithHttpEndpoint(port: 5173, targetPort: 5173, name: "frontend-web")
    .WithReference(backend);

builder.Build().Run();
