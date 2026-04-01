using Amazon.CDK;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Infrastructure.Stacks;

namespace Infrastructure
{
    sealed class Program
    {
        public static void Main(string[] args)
        {
            var app = new App();

            // Try to load config from config.json (preferred) or fall back to --context params
            var configFile = app.Node.TryGetContext("configFile")?.ToString() ?? "../config.json";
            var config = LoadConfigFromFile(configFile);

            var environmentName = config?.GetProperty("environment").GetString()
                ?? app.Node.TryGetContext("environment")?.ToString()
                ?? "production";

            var region = config?.GetProperty("region").GetString()
                ?? "ap-southeast-2";

            var frontendDomain = app.Node.TryGetContext("frontendDomain")?.ToString()
                ?? TryGetConfigString(config, "frontendDomain");

            var domainName = TryGetConfigString(config, "domain")
                ?? app.Node.TryGetContext("domainName")?.ToString();

            var certArnUsEast1 = app.Node.TryGetContext("certificateArnUsEast1")?.ToString()
                ?? TryGetConfigString(config, "certificateArnUsEast1");

            var certArnRegional = app.Node.TryGetContext("certificateArnRegional")?.ToString()
                ?? TryGetConfigString(config, "certificateArnRegional");

            var enableCognitoCustomDomain = app.Node.TryGetContext("enableCognitoCustomDomain")?.ToString() == "true"
                || TryGetConfigBool(config, "enableCognitoCustomDomain");

            var enableGoogleLogin = app.Node.TryGetContext("enableGoogleLogin")?.ToString() == "true"
                || TryGetConfigBool(config, "enableGoogleLogin");

            // Configure environment-specific settings
            var envConfig = GetEnvironmentConfig(environmentName, frontendDomain, domainName, certArnUsEast1, certArnRegional, enableCognitoCustomDomain, enableGoogleLogin);

            var env = new Amazon.CDK.Environment
            {
                Account = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_ACCOUNT"),
                Region = region
            };

            // Create unified stack for the specified environment
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

        /// <summary>
        /// Loads the project config section from a JSON file.
        /// Returns null if the file doesn't exist (backwards compatible with --context params).
        /// </summary>
        private static JsonElement? LoadConfigFromFile(string path)
        {
            if (!File.Exists(path))
                return null;

            try
            {
                var json = File.ReadAllText(path);
                var doc = JsonDocument.Parse(json);

                // Look for the "bluefinwiki" section
                if (doc.RootElement.TryGetProperty("bluefinwiki", out var section))
                    return section;

                return null;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Warning: Could not read config file '{path}': {ex.Message}");
                return null;
            }
        }

        private static string TryGetConfigString(JsonElement? config, string property)
        {
            if (config == null) return null;
            if (config.Value.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String)
            {
                var str = value.GetString();
                return string.IsNullOrWhiteSpace(str) ? null : str;
            }
            return null;
        }

        private static bool TryGetConfigBool(JsonElement? config, string property)
        {
            if (config == null) return false;
            if (config.Value.TryGetProperty(property, out var value))
            {
                if (value.ValueKind == JsonValueKind.True) return true;
                if (value.ValueKind == JsonValueKind.String) return value.GetString() == "true";
            }
            return false;
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
        /// <summary>Base domain for the wiki, e.g. "wiki.yourdomain.com"</summary>
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
