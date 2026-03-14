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
            const string defaultRegion = "ap-southeast-2";
            
            // Get environment from context or default to production
            var environmentName = app.Node.TryGetContext("environment")?.ToString() ?? "production";
            var frontendDomain = app.Node.TryGetContext("frontendDomain")?.ToString();
            
            // Configure environment-specific settings
            var envConfig = GetEnvironmentConfig(environmentName, frontendDomain);
            
            var env = new Amazon.CDK.Environment
            {
                Account = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_ACCOUNT"),
                Region = defaultRegion
            };
            
            // Create unified stack for the specified environment
            // This single stack contains all Auth, Storage, Database, Compute, and CDN resources
            var unifiedStack = new UnifiedStack(app, $"BlueFinWiki-{envConfig.Name}", new StackProps
            {
                Env = env,
                Description = $"BlueFinWiki infrastructure for {envConfig.Name} environment (all resources in single stack)",
                Tags = new Dictionary<string, string>
                {
                    { "Project", "BlueFinWiki" },
                    { "Environment", envConfig.DisplayName }
                }
            }, envConfig);
            
            app.Synth();
        }
        
        private static EnvironmentConfig GetEnvironmentConfig(string environmentName, string frontendDomain)
        {
            return environmentName.ToLower() switch
            {
                "dev" => new EnvironmentConfig
                {
                    Name = "dev",
                    DisplayName = "Development",
                    IsProd = false,
                    EnableVersioning = true,
                    EnableBackups = false,
                    DynamoDbBillingMode = "PAY_PER_REQUEST",
                    LogRetentionDays = 7,
                    CloudFrontPriceClass = "PriceClass_100", // Cheapest
                    FrontendDomain = frontendDomain
                },
                "staging" => new EnvironmentConfig
                {
                    Name = "staging",
                    DisplayName = "Test",
                    IsProd = false,
                    EnableVersioning = true,
                    EnableBackups = true,
                    DynamoDbBillingMode = "PAY_PER_REQUEST",
                    LogRetentionDays = 14,
                    CloudFrontPriceClass = "PriceClass_100",
                    FrontendDomain = frontendDomain
                },
                "production" => new EnvironmentConfig
                {
                    Name = "production",
                    DisplayName = "Production",
                    IsProd = true,
                    EnableVersioning = true,
                    EnableBackups = true,
                    DynamoDbBillingMode = "PAY_PER_REQUEST",
                    LogRetentionDays = 90,
                    CloudFrontPriceClass = "PriceClass_200", // Better global coverage
                    FrontendDomain = frontendDomain
                },
                _ => throw new ArgumentException($"Unknown environment: {environmentName}. Valid values: dev, staging, production")
            };
        }
    }
    
    public class EnvironmentConfig
    {
        public string Name { get; set; }
        public string DisplayName { get; set; }
        public bool IsProd { get; set; }
        public bool EnableVersioning { get; set; }
        public bool EnableBackups { get; set; }
        public string DynamoDbBillingMode { get; set; }
        public int LogRetentionDays { get; set; }
        public string CloudFrontPriceClass { get; set; }
        public string FrontendDomain { get; set; }
    }
}
