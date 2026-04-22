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

            var prefix = TryGetConfigString(config, "prefix")
                ?? app.Node.TryGetContext("prefix")?.ToString()
                ?? "bluefinwiki";

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

            var sesFromAddress = app.Node.TryGetContext("sesFromAddress")?.ToString()
                ?? TryGetConfigString(config, "sesFromAddress");

            var sesFromName = app.Node.TryGetContext("sesFromName")?.ToString()
                ?? TryGetConfigString(config, "sesFromName");

            // Configure environment-specific settings
            var envConfig = GetEnvironmentConfig(prefix, environmentName, frontendDomain, domainName, certArnUsEast1, certArnRegional, enableCognitoCustomDomain, enableGoogleLogin, sesFromAddress, sesFromName);

            var env = new Amazon.CDK.Environment
            {
                Account = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_ACCOUNT"),
                Region = region
            };

            // Create unified stack for the specified environment
            // Stack ID is always "BlueFinWiki-{env}" for CloudFormation compatibility —
            // the prefix controls resource names inside the stack, not the stack name itself.
            var stackId = $"BlueFinWiki-{envConfig.Name}";
            var unifiedStack = new UnifiedStack(app, stackId, new StackProps
            {
                Env = env,
                Description = $"{envConfig.Prefix} infrastructure for {envConfig.Name} environment (all resources in single stack)",
                Tags = new Dictionary<string, string>
                {
                    { "Project", envConfig.Prefix },
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
            string prefix, string environmentName, string frontendDomain,
            string domainName, string certArnUsEast1, string certArnRegional,
            bool enableCognitoCustomDomain, bool enableGoogleLogin,
            string sesFromAddress, string sesFromName)
        {
            return environmentName.ToLower() switch
            {
                "dev" => new EnvironmentConfig
                {
                    Prefix = prefix,
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
                    Prefix = prefix,
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
                    Prefix = prefix,
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
                    EnableGoogleLogin = enableGoogleLogin,
                    SesFromAddress = sesFromAddress,
                    SesFromName = sesFromName
                },
                _ => throw new ArgumentException($"Unknown environment: {environmentName}. Valid values: dev, staging, production")
            };
        }
    }

    public class EnvironmentConfig
    {
        /// <summary>Resource naming prefix (e.g. "bluefinwiki", "familywiki"). Used for all AWS resource names.</summary>
        public string Prefix { get; set; } = "bluefinwiki";
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
        /// <summary>Enable Google federated login (requires secret {prefix}/{env}/google-oauth in Secrets Manager)</summary>
        public bool EnableGoogleLogin { get; set; }
        /// <summary>From address for Cognito emails via SES (e.g. "noreply@yourdomain.com"). Leave empty to use Cognito default email.</summary>
        public string SesFromAddress { get; set; }
        /// <summary>Optional display name for SES-sent emails.</summary>
        public string SesFromName { get; set; }
    }
}
