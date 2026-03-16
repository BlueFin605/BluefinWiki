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
            var domainName = app.Node.TryGetContext("domainName")?.ToString();
            var certArnUsEast1 = app.Node.TryGetContext("certificateArnUsEast1")?.ToString();
            var certArnRegional = app.Node.TryGetContext("certificateArnRegional")?.ToString();
            var enableCognitoCustomDomain = app.Node.TryGetContext("enableCognitoCustomDomain")?.ToString() == "true";
            var enableGoogleLogin = app.Node.TryGetContext("enableGoogleLogin")?.ToString() == "true";

            // Configure environment-specific settings
            var envConfig = GetEnvironmentConfig(environmentName, frontendDomain, domainName, certArnUsEast1, certArnRegional, enableCognitoCustomDomain, enableGoogleLogin);
            
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
        
        private static EnvironmentConfig GetEnvironmentConfig(
            string environmentName, string frontendDomain,
            string domainName, string certArnUsEast1, string certArnRegional,
            bool enableCognitoCustomDomain, bool enableGoogleLogin)
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
                    CloudFrontPriceClass = "PriceClass_100",
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
                    CloudFrontPriceClass = "PriceClass_200",
                    FrontendDomain = frontendDomain,
                    DomainName = domainName,
                    CertificateArnUsEast1 = certArnUsEast1,
                    CertificateArnRegional = certArnRegional,
                    EnableCognitoCustomDomain = enableCognitoCustomDomain,
                    EnableGoogleLogin = enableGoogleLogin
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
        /// <summary>Base domain for the wiki, e.g. "wiki.bluefin605.com"</summary>
        public string DomainName { get; set; }
        /// <summary>ACM certificate ARN in us-east-1 (for CloudFront &amp; Cognito custom domain)</summary>
        public string CertificateArnUsEast1 { get; set; }
        /// <summary>ACM certificate ARN in the stack region (for API Gateway custom domain)</summary>
        public string CertificateArnRegional { get; set; }
        /// <summary>Enable Cognito custom domain (requires parent domain A record to exist first)</summary>
        public bool EnableCognitoCustomDomain { get; set; }
        /// <summary>Enable Google federated login (requires secret bluefinwiki/{env}/google-oauth in Secrets Manager)</summary>
        public bool EnableGoogleLogin { get; set; }
    }
}
