using Aspire.Hosting;

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

// Cognito Local for local authentication testing
// Note: cognito-local is a community project that emulates Cognito User Pools
var cognitoLocal = builder.AddContainer("cognito-local", "jagregory/cognito-local", "latest")
    .WithHttpEndpoint(port: 9229, targetPort: 9229, name: "cognito-local")
    .WithBindMount("./cognito-local-data", "/app/.cognito");

// MailHog for SMTP email testing
var mailhog = builder.AddContainer("mailhog", "mailhog/mailhog", "latest")
    .WithHttpEndpoint(port: 8025, targetPort: 8025, name: "mailhog-ui")
    .WithEndpoint(port: 1025, targetPort: 1025, name: "mailhog-smtp");

builder.Build().Run();
