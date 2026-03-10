using Amazon.CDK;
using System;
using System.Collections.Generic;
using Infrastructure.Stacks;

namespace Infrastructure
{
    sealed class Program
    {
        public static void Main(string[] args)
        {
            var app = new App();
            
            // Get environment from context or default to dev
            var environmentName = app.Node.TryGetContext("environment")?.ToString() ?? "dev";
            
            // Configure environment-specific settings
            var envConfig = GetEnvironmentConfig(environmentName);
            
            var env = new Amazon.CDK.Environment
            {
                Account = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_ACCOUNT"),
                Region = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_REGION") ?? "us-east-1"
            };
            
            // Create stacks for the specified environment
            var stackPrefix = $"BlueFinWiki-{envConfig.Name}";
            
            // Auth Stack (Cognito User Pool and Identity Pool)
            var authStack = new AuthStack(app, $"{stackPrefix}-Auth", new StackProps
            {
                Env = env,
                Description = $"BlueFinWiki Authentication resources for {envConfig.Name} environment",
                Tags = new Dictionary<string, string>
                {
                    { "Project", "IsoChess" },
                    { "Environment", "Prod" }
                }
            }, envConfig);
            
            // Storage Stack (S3 buckets)
            var storageStack = new StorageStack(app, $"{stackPrefix}-Storage", new StackProps
            {
                Env = env,
                Description = $"BlueFinWiki Storage resources for {envConfig.Name} environment",
                Tags = new Dictionary<string, string>
                {
                    { "Project", "IsoChess" },
                    { "Environment", "Prod" }
                }
            }, envConfig);
            
            // Database Stack (DynamoDB tables)
            var databaseStack = new DatabaseStack(app, $"{stackPrefix}-Database", new StackProps
            {
                Env = env,
                Description = $"BlueFinWiki Database resources for {envConfig.Name} environment",
                Tags = new Dictionary<string, string>
                {
                    { "Project", "IsoChess" },
                    { "Environment", "Prod" }
                }
            }, envConfig);
            
            // Compute Stack (Lambda functions, API Gateway)
            var computeStack = new ComputeStack(app, $"{stackPrefix}-Compute", new StackProps
            {
                Env = env,
                Description = $"BlueFinWiki Compute resources for {envConfig.Name} environment",
                Tags = new Dictionary<string, string>
                {
                    { "Project", "IsoChess" },
                    { "Environment", "Prod" }
                }
            }, envConfig, storageStack, databaseStack, authStack);
            
            // CDN Stack (CloudFront distribution) - includes FrontendBucket to avoid circular dependency
            var cdnStack = new CdnStack(app, $"{stackPrefix}-CDN", new StackProps
            {
                Env = env,
                Description = $"BlueFinWiki CDN resources for {envConfig.Name} environment",
                Tags = new Dictionary<string, string>
                {
                    { "Project", "IsoChess" },
                    { "Environment", "Prod" }
                }
            }, envConfig);
            
            app.Synth();
        }
        
        private static EnvironmentConfig GetEnvironmentConfig(string environmentName)
        {
            return environmentName.ToLower() switch
            {
                "dev" => new EnvironmentConfig
                {
                    Name = "dev",
                    IsProd = false,
                    EnableVersioning = true,
                    EnableBackups = false,
                    DynamoDbBillingMode = "PAY_PER_REQUEST",
                    LogRetentionDays = 7,
                    CloudFrontPriceClass = "PriceClass_100" // Cheapest
                },
                "staging" => new EnvironmentConfig
                {
                    Name = "staging",
                    IsProd = false,
                    EnableVersioning = true,
                    EnableBackups = true,
                    DynamoDbBillingMode = "PAY_PER_REQUEST",
                    LogRetentionDays = 14,
                    CloudFrontPriceClass = "PriceClass_100"
                },
                "production" => new EnvironmentConfig
                {
                    Name = "production",
                    IsProd = true,
                    EnableVersioning = true,
                    EnableBackups = true,
                    DynamoDbBillingMode = "PAY_PER_REQUEST",
                    LogRetentionDays = 90,
                    CloudFrontPriceClass = "PriceClass_200" // Better global coverage
                },
                _ => throw new ArgumentException($"Unknown environment: {environmentName}. Valid values: dev, staging, production")
            };
        }
    }
    
    public class EnvironmentConfig
    {
        public string Name { get; set; }
        public bool IsProd { get; set; }
        public bool EnableVersioning { get; set; }
        public bool EnableBackups { get; set; }
        public string DynamoDbBillingMode { get; set; }
        public int LogRetentionDays { get; set; }
        public string CloudFrontPriceClass { get; set; }
    }
}
