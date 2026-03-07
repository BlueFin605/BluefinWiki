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
            storageStack.ExportsBucket.GrantReadWrite(lambdaRole);
            
            // Grant Lambda access to DynamoDB tables
            databaseStack.UserProfilesTable.GrantReadWriteData(lambdaRole);
            databaseStack.InvitationsTable.GrantReadWriteData(lambdaRole);
            databaseStack.PageLinksTable.GrantReadWriteData(lambdaRole);
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
                { "EXPORTS_BUCKET", storageStack.ExportsBucket.BucketName },
                { "USER_PROFILES_TABLE", databaseStack.UserProfilesTable.TableName },
                { "INVITATIONS_TABLE", databaseStack.InvitationsTable.TableName },
                { "PAGE_LINKS_TABLE", databaseStack.PageLinksTable.TableName },
                { "COMMENTS_TABLE", databaseStack.CommentsTable.TableName },
                { "ACTIVITY_LOG_TABLE", databaseStack.ActivityLogTable.TableName },
                { "USER_PREFERENCES_TABLE", databaseStack.UserPreferencesTable.TableName },
                { "SITE_CONFIG_TABLE", databaseStack.SiteConfigTable.TableName },
                { "JWT_SECRET_ARN", JwtSecret.SecretArn },
                { "ENVIRONMENT", config.Name }
            };
            
            // Lambda function base configuration
            var lambdaProps = new FunctionProps
            {
                Runtime = Runtime.NODEJS_20_X,
                Code = Code.FromAsset("../backend/dist"), // Build output directory
                Role = lambdaRole,
                Environment = commonEnvVars,
                Timeout = Duration.Seconds(30),
                MemorySize = 512,
                Tracing = Tracing.ACTIVE,
                LogRetention = (RetentionDays)config.LogRetentionDays
            };
            
            // =============================================================================
            // Pages Lambda Functions (Task 3.3)
            // =============================================================================
            
            var pagesCreateFunction = new Function(this, "PagesCreateFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-create.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Create new page"
            });
            
            var pagesGetFunction = new Function(this, "PagesGetFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-get.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get page by GUID"
            });
            
            var pagesUpdateFunction = new Function(this, "PagesUpdateFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-update.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Update page content and metadata"
            });
            
            var pagesDeleteFunction = new Function(this, "PagesDeleteFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-delete.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Delete page (with optional recursive deletion)"
            });
            
            var pagesListChildrenFunction = new Function(this, "PagesListChildrenFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-list-children.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "List child pages of a parent"
            });
            
            var pagesMoveFunction = new Function(this, "PagesMoveFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-move.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Move page to new parent location"
            });
            
            var pagesSearchFunction = new Function(this, "PagesSearchFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-search.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Search pages by title (for link autocomplete)"
            });

            var pagesAttachmentsUploadFunction = new Function(this, "PagesAttachmentsUploadFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-attachments-upload.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Upload page attachment"
            });

            var pagesAttachmentsDownloadFunction = new Function(this, "PagesAttachmentsDownloadFunction", new FunctionProps
            {
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-attachments-download.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Download page attachment"
            });
            
            // =============================================================================
            // API Gateway Routes - /pages
            // =============================================================================
            
            // Create /pages resource
            var pagesResource = Api.Root.AddResource("pages");
            
            // POST /pages - Create new page
            pagesResource.AddMethod("POST", new LambdaIntegration(pagesCreateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = new CognitoUserPoolsAuthorizer(this, "PagesCreateAuthorizer", new CognitoUserPoolsAuthorizerProps
                {
                    CognitoUserPools = new[] { authStack.UserPool }
                })
            });
            
            // /pages/{guid} resource
            var pageGuidResource = pagesResource.AddResource("{guid}");
            
            // Cognito authorizer for authenticated endpoints
            var cognitoAuthorizer = new CognitoUserPoolsAuthorizer(this, "PagesAuthorizer", new CognitoUserPoolsAuthorizerProps
            {
                CognitoUserPools = new[] { authStack.UserPool }
            });
            
            // GET /pages/{guid} - Get page by GUID
            pageGuidResource.AddMethod("GET", new LambdaIntegration(pagesGetFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
            // PUT /pages/{guid} - Update page
            pageGuidResource.AddMethod("PUT", new LambdaIntegration(pagesUpdateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
            // DELETE /pages/{guid} - Delete page
            pageGuidResource.AddMethod("DELETE", new LambdaIntegration(pagesDeleteFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
            // GET /pages/{guid}/children - List child pages
            var childrenResource = pageGuidResource.AddResource("children");
            childrenResource.AddMethod("GET", new LambdaIntegration(pagesListChildrenFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
            // PUT /pages/{guid}/move - Move page to new parent
            var moveResource = pageGuidResource.AddResource("move");
            moveResource.AddMethod("PUT", new LambdaIntegration(pagesMoveFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
            // GET /pages/search - Search pages by title
            var searchResource = pagesResource.AddResource("search");
            searchResource.AddMethod("GET", new LambdaIntegration(pagesSearchFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /pages/{guid}/attachments - Upload attachment
            var attachmentsResource = pageGuidResource.AddResource("attachments");
            attachmentsResource.AddMethod("POST", new LambdaIntegration(pagesAttachmentsUploadFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // GET /pages/{guid}/attachments/{attachmentGuid} - Download attachment
            var attachmentGuidResource = attachmentsResource.AddResource("{attachmentGuid}");
            attachmentGuidResource.AddMethod("GET", new LambdaIntegration(pagesAttachmentsDownloadFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
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
