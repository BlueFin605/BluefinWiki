using Amazon.CDK;
using Amazon.CDK.AWS.Cognito;
using Amazon.CDK.AWS.CloudFront;
using Amazon.CDK.AWS.CloudFront.Origins;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.APIGateway;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.S3;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;
using System.Collections.Generic;
using LambdaFunction = Amazon.CDK.AWS.Lambda.Function;
using LambdaFunctionProps = Amazon.CDK.AWS.Lambda.FunctionProps;
using CloudFrontDistribution = Amazon.CDK.AWS.CloudFront.Distribution;

namespace Infrastructure.Stacks
{
    /// <summary>
    /// Unified Stack - All BlueFinWiki infrastructure in a single CloudFormation stack
    /// Combines Auth, Storage, Database, Compute, and CDN resources
    /// </summary>
    public class UnifiedStack : Stack
    {
        // Auth resources
        public UserPool UserPool { get; private set; }
        public UserPoolClient WebClient { get; private set; }
        public UserPoolClient NativeClient { get; private set; }
        public CfnIdentityPool IdentityPool { get; private set; }
        
        // Storage resources
        public IBucket PagesBucket { get; private set; }
        public IBucket FrontendBucket { get; private set; }
        
        // Database resources
        public Table UserProfilesTable { get; private set; }
        public Table InvitationsTable { get; private set; }
        public Table PageLinksTable { get; private set; }
        public Table ActivityLogTable { get; private set; }
        
        // Compute resources
        public RestApi Api { get; private set; }
        public ISecret JwtSecret { get; private set; }
        
        // CDN resources
        public IDistribution Distribution { get; private set; }
        
        internal UnifiedStack(Construct scope, string id, IStackProps props, EnvironmentConfig config) 
            : base(scope, id, props)
        {
            // =============================================================================
            // STORAGE RESOURCES
            // =============================================================================
            
            CreateStorageResources(config);
            
            // =============================================================================
            // DATABASE RESOURCES
            // =============================================================================
            
            CreateDatabaseResources(config);
            
            // =============================================================================
            // CDN RESOURCES
            // =============================================================================
            
            CreateCdnResources(config);

            // =============================================================================
            // AUTH RESOURCES
            // =============================================================================
            
            CreateAuthResources(config);

            // =============================================================================
            // COMPUTE RESOURCES
            // =============================================================================
            
            CreateComputeResources(config);
        }
        
        private void CreateAuthResources(EnvironmentConfig config)
        {
            // Create Cognito User Pool
            UserPool = new UserPool(this, "UserPool", new UserPoolProps
            {
                UserPoolName = $"bluefinwiki-users-{config.Name}",
                
                // Sign-in configuration
                SignInAliases = new SignInAliases
                {
                    Email = true,
                    Username = false // Use email as username
                },
                
                // Self-registration disabled (invite-only)
                SelfSignUpEnabled = false,
                
                // Required standard attributes
                StandardAttributes = new StandardAttributes
                {
                    Email = new StandardAttribute
                    {
                        Required = true,
                        Mutable = true
                    },
                    GivenName = new StandardAttribute
                    {
                        Required = false,
                        Mutable = true
                    },
                    FamilyName = new StandardAttribute
                    {
                        Required = false,
                        Mutable = true
                    }
                },
                
                // Custom attributes for role-based access control
                CustomAttributes = new Dictionary<string, ICustomAttribute>
                {
                    {
                        "role",
                        new StringAttribute(new StringAttributeProps
                        {
                            MinLen = 1,
                            MaxLen = 20,
                            Mutable = true
                        })
                    }
                },
                
                // Password policy
                PasswordPolicy = new PasswordPolicy
                {
                    MinLength = 8,
                    RequireLowercase = true,
                    RequireUppercase = true,
                    RequireDigits = true,
                    RequireSymbols = true,
                    TempPasswordValidity = Duration.Days(7)
                },
                
                // Account recovery
                AccountRecovery = AccountRecovery.EMAIL_ONLY,
                
                // Email configuration (use Cognito default for MVP)
                Email = UserPoolEmail.WithCognito(),
                
                // Email verification
                AutoVerify = new AutoVerifiedAttrs
                {
                    Email = true
                },
                
                // User verification (admin creates users)
                UserVerification = new UserVerificationConfig
                {
                    EmailSubject = "Verify your BlueFinWiki account",
                    EmailBody = "Welcome to BlueFinWiki! Your verification code is {####}",
                    EmailStyle = VerificationEmailStyle.CODE
                },
                
                // User invitation (for admin-created accounts)
                UserInvitation = new UserInvitationConfig
                {
                    EmailSubject = "Welcome to BlueFinWiki",
                    EmailBody = "Welcome to BlueFinWiki! Your username is {username} and temporary password is {####}. Please change your password after first login."
                },
                
                // MFA configuration (optional for MVP)
                Mfa = Mfa.OPTIONAL,
                MfaSecondFactor = new MfaSecondFactor
                {
                    Sms = false,
                    Otp = true // TOTP apps like Google Authenticator
                },
                
                // Device tracking for "Remember me"
                DeviceTracking = new DeviceTracking
                {
                    ChallengeRequiredOnNewDevice = false,
                    DeviceOnlyRememberedOnUserPrompt = true
                },
                
                // Keep users for data retention compliance
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
                
                // Enable deletion protection in production
                DeletionProtection = config.IsProd
            });
            
            // Create Web Client (for React SPA)
            WebClient = new UserPoolClient(this, "WebClient", new UserPoolClientProps
            {
                UserPool = UserPool,
                UserPoolClientName = $"bluefinwiki-web-{config.Name}",
                
                // OAuth flows
                AuthFlows = new AuthFlow
                {
                    UserPassword = true, // Username-password authentication
                    UserSrp = true, // Secure Remote Password
                    Custom = false,
                    AdminUserPassword = true // For admin operations
                },
                
                // OAuth 2.0 grants
                OAuth = new OAuthSettings
                {
                    Flows = new OAuthFlows
                    {
                        AuthorizationCodeGrant = true,
                        ImplicitCodeGrant = true // For SPA fallback
                    },
                    Scopes = new[]
                    {
                        OAuthScope.EMAIL,
                        OAuthScope.OPENID,
                        OAuthScope.PROFILE
                    },
                    CallbackUrls = GetCallbackUrls(config),
                    LogoutUrls = GetLogoutUrls(config)
                },
                
                // Token validity
                AccessTokenValidity = Duration.Hours(1),
                IdTokenValidity = Duration.Hours(1),
                RefreshTokenValidity = Duration.Days(30),
                
                // Prevent user existence errors
                PreventUserExistenceErrors = true,
                
                // Enable token revocation
                EnableTokenRevocation = true
            });

            var hostedUiDomainPrefix = GetHostedUiDomainPrefix(config);
            var userPoolDomain = new CfnUserPoolDomain(this, "UserPoolDomain", new CfnUserPoolDomainProps
            {
                UserPoolId = UserPool.UserPoolId,
                Domain = hostedUiDomainPrefix
            });
            
            // Create Native Client (for future mobile apps)
            NativeClient = new UserPoolClient(this, "NativeClient", new UserPoolClientProps
            {
                UserPool = UserPool,
                UserPoolClientName = $"bluefinwiki-mobile-{config.Name}",
                
                AuthFlows = new AuthFlow
                {
                    UserPassword = true,
                    UserSrp = true,
                    Custom = false
                },
                
                OAuth = new OAuthSettings
                {
                    Flows = new OAuthFlows
                    {
                        AuthorizationCodeGrant = true
                    },
                    Scopes = new[]
                    {
                        OAuthScope.EMAIL,
                        OAuthScope.OPENID,
                        OAuthScope.PROFILE
                    },
                    CallbackUrls = new[] { "bluefinwiki://callback" },
                    LogoutUrls = new[] { "bluefinwiki://logout" }
                },
                
                AccessTokenValidity = Duration.Hours(1),
                IdTokenValidity = Duration.Hours(1),
                RefreshTokenValidity = Duration.Days(30),
                
                PreventUserExistenceErrors = true,
                EnableTokenRevocation = true
            });
            
            // Create Identity Pool (for AWS credential access if needed)
            IdentityPool = new CfnIdentityPool(this, "IdentityPool", new CfnIdentityPoolProps
            {
                IdentityPoolName = $"bluefinwiki_identity_{config.Name}",
                AllowUnauthenticatedIdentities = false,
                CognitoIdentityProviders = new[]
                {
                    new CfnIdentityPool.CognitoIdentityProviderProperty
                    {
                        ClientId = WebClient.UserPoolClientId,
                        ProviderName = UserPool.UserPoolProviderName
                    }
                }
            });
            
            // Create IAM roles for authenticated users
            var authenticatedRole = new Role(this, "AuthenticatedRole", new RoleProps
            {
                AssumedBy = new FederatedPrincipal(
                    "cognito-identity.amazonaws.com",
                    new Dictionary<string, object>
                    {
                        { "StringEquals", new Dictionary<string, string>
                            {
                                { "cognito-identity.amazonaws.com:aud", IdentityPool.Ref }
                            }
                        },
                        { "ForAnyValue:StringLike", new Dictionary<string, string>
                            {
                                { "cognito-identity.amazonaws.com:amr", "authenticated" }
                            }
                        }
                    },
                    "sts:AssumeRoleWithWebIdentity"
                )
            });
            
            // Attach role to identity pool
            new CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", 
                new CfnIdentityPoolRoleAttachmentProps
                {
                    IdentityPoolId = IdentityPool.Ref,
                    Roles = new Dictionary<string, string>
                    {
                        { "authenticated", authenticatedRole.RoleArn }
                    }
                });
            
            // Auth Stack outputs
            new CfnOutput(this, "UserPoolId", new CfnOutputProps
            {
                Value = UserPool.UserPoolId,
                Description = "Cognito User Pool ID",
                ExportName = $"{config.Name}-user-pool-id"
            });
            
            new CfnOutput(this, "UserPoolArn", new CfnOutputProps
            {
                Value = UserPool.UserPoolArn,
                Description = "Cognito User Pool ARN",
                ExportName = $"{config.Name}-user-pool-arn"
            });
            
            new CfnOutput(this, "WebClientId", new CfnOutputProps
            {
                Value = WebClient.UserPoolClientId,
                Description = "Cognito Web Client ID",
                ExportName = $"{config.Name}-web-client-id"
            });

            new CfnOutput(this, "CognitoDomainPrefix", new CfnOutputProps
            {
                Value = userPoolDomain.Domain,
                Description = "Cognito Hosted UI domain prefix",
                ExportName = $"{config.Name}-cognito-domain-prefix"
            });
            
            new CfnOutput(this, "IdentityPoolId", new CfnOutputProps
            {
                Value = IdentityPool.Ref,
                Description = "Cognito Identity Pool ID",
                ExportName = $"{config.Name}-identity-pool-id"
            });
        }
        
        private void CreateStorageResources(EnvironmentConfig config)
        {
            // S3 Bucket for page content storage
            PagesBucket = new Bucket(this, "PagesBucket", new BucketProps
            {
                BucketName = $"bluefinwiki-pages-{config.Name}",
                Versioned = config.EnableVersioning,
                Encryption = BucketEncryption.S3_MANAGED,
                BlockPublicAccess = BlockPublicAccess.BLOCK_ALL,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
                AutoDeleteObjects = !config.IsProd,
                LifecycleRules = new[]
                {
                    new LifecycleRule
                    {
                        Id = "DeleteOldVersions",
                        NoncurrentVersionExpiration = Duration.Days(365),
                        Enabled = config.EnableVersioning
                    }
                },
                Cors = new[]
                {
                    new CorsRule
                    {
                        AllowedMethods = new[] { HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST, HttpMethods.DELETE },
                        AllowedOrigins = new[] { "*" }, // Will be restricted to CloudFront in production
                        AllowedHeaders = new[] { "*" },
                        MaxAge = 3000
                    }
                }
            });
            
            // Storage Stack outputs
            new CfnOutput(this, "PagesBucketName", new CfnOutputProps
            {
                Value = PagesBucket.BucketName,
                Description = "S3 bucket for page storage (includes attachments at {pageGuid}/_attachments/)",
                ExportName = $"{config.Name}-pages-bucket"
            });
        }
        
        private void CreateDatabaseResources(EnvironmentConfig config)
        {
            // User Profiles table - extended user data (Cognito stores core auth)
            // PK: cognitoUserId (Cognito sub claim)
            // Stores: email, displayName, role, inviteCode, status, createdAt, lastLogin
            UserProfilesTable = new Table(this, "UserProfilesTable", new TableProps
            {
                TableName = $"bluefinwiki-user-profiles-{config.Name}",
                PartitionKey = new Attribute { Name = "cognitoUserId", Type = AttributeType.STRING },
                BillingMode = config.DynamoDbBillingMode == "PAY_PER_REQUEST" 
                    ? BillingMode.PAY_PER_REQUEST 
                    : BillingMode.PROVISIONED,
                PointInTimeRecoverySpecification = new PointInTimeRecoverySpecification
                {
                    PointInTimeRecoveryEnabled = config.EnableBackups
                },
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
                Encryption = TableEncryption.AWS_MANAGED,
                Stream = StreamViewType.NEW_AND_OLD_IMAGES // For audit logging
            });
            
            // GSI for email lookups (for user search/display)
            UserProfilesTable.AddGlobalSecondaryIndex(new GlobalSecondaryIndexProps
            {
                IndexName = "email-index",
                PartitionKey = new Attribute { Name = "email", Type = AttributeType.STRING },
                ProjectionType = ProjectionType.ALL
            });
            
            // Invitations table - invite codes for user registration
            // PK: inviteCode (8-char alphanumeric)
            // Attributes: email (optional), role, createdBy, createdAt, expiresAt, status, usedBy, usedAt
            // TTL on expiresAt for auto-cleanup after 30 days
            InvitationsTable = new Table(this, "InvitationsTable", new TableProps
            {
                TableName = $"bluefinwiki-invitations-{config.Name}",
                PartitionKey = new Attribute { Name = "inviteCode", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                Encryption = TableEncryption.AWS_MANAGED,
                TimeToLiveAttribute = "expiresAt" // Auto-delete expired invitations (Unix timestamp)
            });
            
            // Page Links table - for backlinks tracking
            PageLinksTable = new Table(this, "PageLinksTable", new TableProps
            {
                TableName = $"bluefinwiki-page-links-{config.Name}",
                PartitionKey = new Attribute { Name = "sourceGuid", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "targetGuid", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });
            
            // GSI for querying backlinks (who links to this page?)
            PageLinksTable.AddGlobalSecondaryIndex(new GlobalSecondaryIndexProps
            {
                IndexName = "targetGuid-index",
                PartitionKey = new Attribute { Name = "targetGuid", Type = AttributeType.STRING },
                ProjectionType = ProjectionType.ALL
            });
            
            // Activity Log table - audit trail
            // PK: userId (Cognito sub), SK: timestamp
            // Note: userId references Cognito sub (UUID from Cognito tokens)
            ActivityLogTable = new Table(this, "ActivityLogTable", new TableProps
            {
                TableName = $"bluefinwiki-activity-log-{config.Name}",
                PartitionKey = new Attribute { Name = "userId", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "timestamp", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                TimeToLiveAttribute = "expiresAt" // Auto-delete old logs (90 days, Unix timestamp)
            });
            
            // Database Stack outputs
            new CfnOutput(this, "UserProfilesTableName", new CfnOutputProps
            {
                Value = UserProfilesTable.TableName,
                Description = "DynamoDB table for user profiles (extended Cognito data)",
                ExportName = $"{config.Name}-user-profiles-table"
            });
            
            new CfnOutput(this, "InvitationsTableName", new CfnOutputProps
            {
                Value = InvitationsTable.TableName,
                Description = "DynamoDB table for invitation codes",
                ExportName = $"{config.Name}-invitations-table"
            });
            
            new CfnOutput(this, "PageLinksTableName", new CfnOutputProps
            {
                Value = PageLinksTable.TableName,
                Description = "DynamoDB table for page links",
                ExportName = $"{config.Name}-page-links-table"
            });
        }
        
        private void CreateComputeResources(EnvironmentConfig config)
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
                BinaryMediaTypes = new[] { "multipart/form-data" },
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
            
            // Grant Lambda access to S3 bucket
            PagesBucket.GrantReadWrite(lambdaRole);
            
            // Grant Lambda access to DynamoDB tables
            UserProfilesTable.GrantReadWriteData(lambdaRole);
            InvitationsTable.GrantReadWriteData(lambdaRole);
            PageLinksTable.GrantReadWriteData(lambdaRole);
            ActivityLogTable.GrantReadWriteData(lambdaRole);
            
            // Grant Lambda access to JWT secret
            JwtSecret.GrantRead(lambdaRole);
            
            // Common Lambda environment variables
            var commonEnvVars = new Dictionary<string, string>
            {
                { "PAGES_BUCKET", PagesBucket.BucketName },
                { "COGNITO_USER_POOL_ID", UserPool.UserPoolId },
                { "COGNITO_CLIENT_ID", WebClient.UserPoolClientId },
                { "USER_PROFILES_TABLE", UserProfilesTable.TableName },
                { "INVITATIONS_TABLE", InvitationsTable.TableName },
                { "PAGE_LINKS_TABLE", PageLinksTable.TableName },
                { "ACTIVITY_LOG_TABLE", ActivityLogTable.TableName },
                { "JWT_SECRET_ARN", JwtSecret.SecretArn },
                { "ENVIRONMENT", config.Name }
            };
            
            // Lambda function base configuration
            var lambdaProps = new LambdaFunctionProps
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
            
            var pagesCreateFunction = new LambdaFunction(this, "PagesCreateFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-create",
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
            
            var pagesGetFunction = new LambdaFunction(this, "PagesGetFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-get",
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
            
            var pagesUpdateFunction = new LambdaFunction(this, "PagesUpdateFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-update",
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
            
            var pagesDeleteFunction = new LambdaFunction(this, "PagesDeleteFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-delete",
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
            
            var pagesListChildrenFunction = new LambdaFunction(this, "PagesListChildrenFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-list-children",
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
            
            var pagesMoveFunction = new LambdaFunction(this, "PagesMoveFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-move",
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
            
            var pagesSearchFunction = new LambdaFunction(this, "PagesSearchFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-search",
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

            var pagesBacklinksFunction = new LambdaFunction(this, "PagesBacklinksFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-backlinks",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-backlinks.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get backlinks for a page"
            });

            var pagesAttachmentsUploadFunction = new LambdaFunction(this, "PagesAttachmentsUploadFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-attachments-upload",
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

            var pagesAttachmentsDownloadFunction = new LambdaFunction(this, "PagesAttachmentsDownloadFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-attachments-download",
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

            var pagesAttachmentsListFunction = new LambdaFunction(this, "PagesAttachmentsListFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-attachments-list",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-attachments-list.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "List page attachments"
            });

            var pagesAttachmentsDeleteFunction = new LambdaFunction(this, "PagesAttachmentsDeleteFunction", new LambdaFunctionProps
            {
                FunctionName = $"bluefinwiki-{config.Name}-pages-attachments-delete",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-attachments-delete.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Delete page attachment"
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
                    CognitoUserPools = new[] { UserPool }
                })
            });
            
            // /pages/{guid} resource
            var pageGuidResource = pagesResource.AddResource("{guid}");
            
            // Cognito authorizer for authenticated endpoints
            var cognitoAuthorizer = new CognitoUserPoolsAuthorizer(this, "PagesAuthorizer", new CognitoUserPoolsAuthorizerProps
            {
                CognitoUserPools = new[] { UserPool }
            });

            // GET /pages/children - List root pages (legacy alias)
            var pagesChildrenResource = pagesResource.AddResource("children");
            pagesChildrenResource.AddMethod("GET", new LambdaIntegration(pagesListChildrenFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
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

            // GET /pages/{guid}/backlinks - Get pages that link to this page
            var backlinksResource = pageGuidResource.AddResource("backlinks");
            backlinksResource.AddMethod("GET", new LambdaIntegration(pagesBacklinksFunction), new MethodOptions
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

            // GET /pages/{guid}/attachments - List attachments
            attachmentsResource.AddMethod("GET", new LambdaIntegration(pagesAttachmentsListFunction), new MethodOptions
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

            // DELETE /pages/{guid}/attachments/{attachmentGuid} - Delete attachment
            attachmentGuidResource.AddMethod("DELETE", new LambdaIntegration(pagesAttachmentsDeleteFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });
            
            // Compute Stack outputs
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
        
        private void CreateCdnResources(EnvironmentConfig config)
        {
            // S3 Bucket for frontend static hosting (SPA)
            FrontendBucket = new Bucket(this, "FrontendBucket", new BucketProps
            {
                BucketName = $"bluefinwiki-frontend-{config.Name}",
                Versioned = false,
                Encryption = BucketEncryption.S3_MANAGED,
                PublicReadAccess = false,
                BlockPublicAccess = BlockPublicAccess.BLOCK_ALL,
                RemovalPolicy = RemovalPolicy.DESTROY,
                AutoDeleteObjects = true,
                WebsiteIndexDocument = "index.html",
                WebsiteErrorDocument = "index.html" // For SPA routing
            });
            
            // CloudFront Origin Access Identity for S3
            var originAccessIdentity = new OriginAccessIdentity(this, "FrontendOAI", new OriginAccessIdentityProps
            {
                Comment = $"OAI for BlueFinWiki frontend {config.Name}"
            });
            
            // Cache policy for static assets (long TTL)
            var staticCachePolicy = new CachePolicy(this, "StaticCachePolicy", new CachePolicyProps
            {
                CachePolicyName = $"bluefinwiki-static-{config.Name}",
                Comment = "Cache policy for static assets (JS, CSS, images)",
                DefaultTtl = Duration.Days(30),
                MinTtl = Duration.Days(1),
                MaxTtl = Duration.Days(365),
                EnableAcceptEncodingBrotli = true,
                EnableAcceptEncodingGzip = true,
                HeaderBehavior = CacheHeaderBehavior.None(),
                QueryStringBehavior = CacheQueryStringBehavior.None(),
                CookieBehavior = CacheCookieBehavior.None()
            });
            
            // Cache policy for SPA routing (no caching for index.html)
            var noCachePolicy = new CachePolicy(this, "NoCachePolicy", new CachePolicyProps
            {
                CachePolicyName = $"bluefinwiki-no-cache-{config.Name}",
                Comment = "No cache policy for SPA routing",
                DefaultTtl = Duration.Seconds(0),
                MinTtl = Duration.Seconds(0),
                MaxTtl = Duration.Seconds(0)
            });
            
            // CloudFront distribution
            Distribution = new CloudFrontDistribution(this, "FrontendDistribution", new DistributionProps
            {
                Comment = $"BlueFinWiki frontend distribution for {config.Name}",
                DefaultRootObject = "index.html",
                PriceClass = config.CloudFrontPriceClass == "PriceClass_100" 
                    ? PriceClass.PRICE_CLASS_100 
                    : PriceClass.PRICE_CLASS_200,
                EnableLogging = config.IsProd,
                HttpVersion = HttpVersion.HTTP2_AND_3,
                MinimumProtocolVersion = SecurityPolicyProtocol.TLS_V1_2_2021,
                
                DefaultBehavior = new BehaviorOptions
                {
                    Origin = S3BucketOrigin.WithOriginAccessIdentity(FrontendBucket, new S3BucketOriginWithOAIProps
                    {
                        OriginAccessIdentity = originAccessIdentity
                    }),
                    ViewerProtocolPolicy = ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    AllowedMethods = AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    CachedMethods = CachedMethods.CACHE_GET_HEAD_OPTIONS,
                    Compress = true,
                    CachePolicy = noCachePolicy // Don't cache index.html for SPA routing
                },
                
                AdditionalBehaviors = new Dictionary<string, IBehaviorOptions>
                {
                    // Cache static assets (JS, CSS, images) aggressively
                    ["/assets/*"] = new BehaviorOptions
                    {
                        Origin = S3BucketOrigin.WithOriginAccessIdentity(FrontendBucket, new S3BucketOriginWithOAIProps
                        {
                            OriginAccessIdentity = originAccessIdentity
                        }),
                        ViewerProtocolPolicy = ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                        CachePolicy = staticCachePolicy,
                        Compress = true
                    }
                },
                
                // Custom error responses for SPA routing
                ErrorResponses = new[]
                {
                    new ErrorResponse
                    {
                        HttpStatus = 403,
                        ResponseHttpStatus = 200,
                        ResponsePagePath = "/index.html",
                        Ttl = Duration.Seconds(0)
                    },
                    new ErrorResponse
                    {
                        HttpStatus = 404,
                        ResponseHttpStatus = 200,
                        ResponsePagePath = "/index.html",
                        Ttl = Duration.Seconds(0)
                    }
                }
            });
            
            // CDN Stack outputs
            new CfnOutput(this, "FrontendBucketName", new CfnOutputProps
            {
                Value = FrontendBucket.BucketName,
                Description = "S3 bucket for frontend static files",
                ExportName = $"{config.Name}-frontend-bucket"
            });
            
            new CfnOutput(this, "DistributionId", new CfnOutputProps
            {
                Value = Distribution.DistributionId,
                Description = "CloudFront distribution ID",
                ExportName = $"{config.Name}-distribution-id"
            });
            
            new CfnOutput(this, "DistributionDomainName", new CfnOutputProps
            {
                Value = Distribution.DistributionDomainName,
                Description = "CloudFront distribution domain name",
                ExportName = $"{config.Name}-distribution-domain"
            });
            
            new CfnOutput(this, "FrontendUrl", new CfnOutputProps
            {
                Value = $"https://{Distribution.DistributionDomainName}",
                Description = "Frontend URL (CloudFront)",
                ExportName = $"{config.Name}-frontend-url"
            });
        }
        
        private string[] GetCallbackUrls(EnvironmentConfig config)
        {
            var frontendBaseUrl = GetFrontendBaseUrl(config);

            return config.Name switch
            {
                "dev" => new[] { "http://localhost:5173/callback" },
                "staging" => new[] { $"{frontendBaseUrl}/callback" },
                "production" => new[] { $"{frontendBaseUrl}/callback" },
                _ => new[] { "http://localhost:5173/callback" }
            };
        }
        
        private string[] GetLogoutUrls(EnvironmentConfig config)
        {
            var frontendBaseUrl = GetFrontendBaseUrl(config);

            return config.Name switch
            {
                "dev" => new[] { "http://localhost:5173" },
                "staging" => new[] { frontendBaseUrl },
                "production" => new[] { frontendBaseUrl },
                _ => new[] { "http://localhost:5173" }
            };
        }

        private string GetFrontendBaseUrl(EnvironmentConfig config)
        {
            if (!string.IsNullOrWhiteSpace(config.FrontendDomain))
            {
                var frontendDomain = config.FrontendDomain.Trim();

                if (frontendDomain.StartsWith("http://", System.StringComparison.OrdinalIgnoreCase) ||
                    frontendDomain.StartsWith("https://", System.StringComparison.OrdinalIgnoreCase))
                {
                    return frontendDomain.TrimEnd('/');
                }

                return $"https://{frontendDomain.TrimEnd('/')}";
            }

            return $"https://{Distribution.DistributionDomainName}";
        }

        private string GetHostedUiDomainPrefix(EnvironmentConfig config)
        {
            return $"bluefinwiki-{config.Name}-{Aws.ACCOUNT_ID}";
        }
    }
}
