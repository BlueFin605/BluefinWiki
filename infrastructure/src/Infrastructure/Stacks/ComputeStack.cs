using Amazon.CDK;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.APIGateway;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;
using System.Collections.Generic;

namespace Infrastructure.Stacks
{
    /// <summary>
    /// Compute Stack - Lambda functions and API Gateway
    /// </summary>
    public class ComputeStack : Stack
    {
        public RestApi Api { get; private set; }
        public ISecret JwtSecret { get; private set; }
        
        internal ComputeStack(Construct scope, string id, IStackProps props, EnvironmentConfig config, 
            StorageStack storageStack, DatabaseStack databaseStack, AuthStack authStack) 
            : base(scope, id, props)
        {
            // Create JWT secret in Secrets Manager
            JwtSecret = new Secret(this, "JwtSecret", new SecretProps
            {
                SecretName = $"bluefinwiki/{config.Name}/jwt-secret",
                Description = "JWT signing secret for authentication",
                GenerateSecretString = new SecretStringGenerator
                {
                    SecretStringTemplate = "{}",
                    GenerateStringKey = "secret",
                    PasswordLength = 64,
                    ExcludePunctuation = true
                }
            });
            
            // API Gateway REST API
            Api = new RestApi(this, "BlueFinWikiApi", new RestApiProps
            {
                RestApiName = $"bluefinwiki-api-{config.Name}",
                Description = $"BlueFinWiki API for {config.Name} environment",
                DeployOptions = new StageOptions
                {
                    StageName = config.Name,
                    ThrottlingBurstLimit = 100,
                    ThrottlingRateLimit = 50,
                    LoggingLevel = MethodLoggingLevel.INFO,
                    DataTraceEnabled = !config.IsProd,
                    MetricsEnabled = true
                },
                DefaultCorsPreflightOptions = new CorsOptions
                {
                    AllowOrigins = Cors.ALL_ORIGINS, // Will be restricted in production
                    AllowMethods = Cors.ALL_METHODS,
                    AllowHeaders = new[] { "Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token" },
                    AllowCredentials = true
                }
            });
            
            // Create IAM role for Lambda functions
            var lambdaRole = new Role(this, "LambdaExecutionRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                    ManagedPolicy.FromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
                }
            });
            
            // Grant Lambda access to S3 buckets
            storageStack.PagesBucket.GrantReadWrite(lambdaRole);
            storageStack.AttachmentsBucket.GrantReadWrite(lambdaRole);
            storageStack.ExportsBucket.GrantReadWrite(lambdaRole);
            
            // Grant Lambda access to DynamoDB tables
            databaseStack.UserProfilesTable.GrantReadWriteData(lambdaRole);
            databaseStack.InvitationsTable.GrantReadWriteData(lambdaRole);
            databaseStack.PageLinksTable.GrantReadWriteData(lambdaRole);
            databaseStack.AttachmentsTable.GrantReadWriteData(lambdaRole);
            databaseStack.CommentsTable.GrantReadWriteData(lambdaRole);
            databaseStack.ActivityLogTable.GrantReadWriteData(lambdaRole);
            databaseStack.UserPreferencesTable.GrantReadWriteData(lambdaRole);
            databaseStack.SiteConfigTable.GrantReadWriteData(lambdaRole);
            
            // Grant Lambda access to JWT secret
            JwtSecret.GrantRead(lambdaRole);
            
            // Common Lambda environment variables
            var commonEnvVars = new Dictionary<string, string>
            {
                { "PAGES_BUCKET", storageStack.PagesBucket.BucketName },
                { "ATTACHMENTS_BUCKET", storageStack.AttachmentsBucket.BucketName },
                { "EXPORTS_BUCKET", storageStack.ExportsBucket.BucketName },
                { "USER_PROFILES_TABLE", databaseStack.UserProfilesTable.TableName },
                { "INVITATIONS_TABLE", databaseStack.InvitationsTable.TableName },
                { "PAGE_LINKS_TABLE", databaseStack.PageLinksTable.TableName },
                { "ATTACHMENTS_TABLE", databaseStack.AttachmentsTable.TableName },
                { "COMMENTS_TABLE", databaseStack.CommentsTable.TableName },
                { "ACTIVITY_LOG_TABLE", databaseStack.ActivityLogTable.TableName },
                { "USER_PREFERENCES_TABLE", databaseStack.UserPreferencesTable.TableName },
                { "SITE_CONFIG_TABLE", databaseStack.SiteConfigTable.TableName },
                { "JWT_SECRET_ARN", JwtSecret.SecretArn },
                { "ENVIRONMENT", config.Name }
            };
            
            // Lambda function configuration (placeholder - actual functions will be added during implementation)
            var lambdaProps = new FunctionProps
            {
                Runtime = Runtime.NODEJS_20_X,
                Handler = "index.handler",
                Code = Code.FromInline("exports.handler = async () => ({ statusCode: 200, body: 'Placeholder' });"),
                Role = lambdaRole,
                Environment = commonEnvVars,
                Timeout = Duration.Seconds(30),
                MemorySize = 512,
                Tracing = Tracing.ACTIVE,
                LogRetention = (RetentionDays)config.LogRetentionDays
            };
            
            // Placeholder Lambda function (will be replaced with actual implementations)
            var placeholderFunction = new Function(this, "PlaceholderFunction", lambdaProps);
            
            // API Gateway integration (placeholder)
            var integration = new LambdaIntegration(placeholderFunction);
            Api.Root.AddMethod("GET", integration);
            
            // Stack outputs
            new CfnOutput(this, "ApiUrl", new CfnOutputProps
            {
                Value = Api.UrlForPath("/"),
                Description = "API Gateway endpoint URL",
                ExportName = $"{config.Name}-api-url"
            });
            
            new CfnOutput(this, "ApiId", new CfnOutputProps
            {
                Value = Api.RestApiId,
                Description = "API Gateway ID",
                ExportName = $"{config.Name}-api-id"
            });
            
            new CfnOutput(this, "JwtSecretArn", new CfnOutputProps
            {
                Value = JwtSecret.SecretArn,
                Description = "JWT secret ARN in Secrets Manager",
                ExportName = $"{config.Name}-jwt-secret-arn"
            });
        }
    }
}
