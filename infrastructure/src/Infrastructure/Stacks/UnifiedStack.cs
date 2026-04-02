using Amazon.CDK;
using Amazon.CDK.AWS.CertificateManager;
using Amazon.CDK.AWS.Cognito;
using Amazon.CDK.AWS.CloudFront;
using Amazon.CDK.AWS.CloudFront.Origins;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.APIGateway;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.S3;
using Amazon.CDK.AWS.S3.Notifications;
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
        public Table PageIndexTable { get; private set; }
        public Table TagsTable { get; private set; }
        public Table PageTypesTable { get; private set; }
        
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
                UserPoolName = $"{config.Prefix}-users-{config.Name}",
                
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
            
            // Supported identity providers for the Web Client
            var supportedProviders = new List<UserPoolClientIdentityProvider>
            {
                UserPoolClientIdentityProvider.COGNITO
            };
            if (config.EnableGoogleLogin)
            {
                supportedProviders.Add(UserPoolClientIdentityProvider.GOOGLE);
            }

            // Create Web Client (for React SPA)
            WebClient = new UserPoolClient(this, "WebClient", new UserPoolClientProps
            {
                UserPool = UserPool,
                UserPoolClientName = $"{config.Prefix}-web-{config.Name}",

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

                SupportedIdentityProviders = supportedProviders.ToArray(),

                // Token validity
                AccessTokenValidity = Duration.Hours(1),
                IdTokenValidity = Duration.Hours(1),
                RefreshTokenValidity = Duration.Days(30),

                // Prevent user existence errors
                PreventUserExistenceErrors = true,

                // Enable token revocation
                EnableTokenRevocation = true
            });

            // Cognito domain — use custom domain if configured, otherwise prefix-based
            CfnUserPoolDomain userPoolDomain;
            string cognitoDomainValue;

            // Cognito custom domain requires the parent domain to have a DNS A record first.
            // Phase 1: deploy with prefix domain, set up DNS, then Phase 2: switch to custom domain.
            // Set enableCognitoCustomDomain context to "true" for Phase 2.
            var enableCognitoCustomDomain = config.EnableCognitoCustomDomain
                && !string.IsNullOrWhiteSpace(config.CertificateArnUsEast1)
                && !string.IsNullOrWhiteSpace(config.DomainName);

            if (enableCognitoCustomDomain)
            {
                var authDomain = $"auth.{config.DomainName}";
                userPoolDomain = new CfnUserPoolDomain(this, "UserPoolCustomDomain", new CfnUserPoolDomainProps
                {
                    UserPoolId = UserPool.UserPoolId,
                    Domain = authDomain,
                    CustomDomainConfig = new CfnUserPoolDomain.CustomDomainConfigTypeProperty
                    {
                        CertificateArn = config.CertificateArnUsEast1
                    }
                });
                cognitoDomainValue = authDomain;
            }
            else
            {
                var hostedUiDomainPrefix = GetHostedUiDomainPrefix(config);
                userPoolDomain = new CfnUserPoolDomain(this, "UserPoolDomain", new CfnUserPoolDomainProps
                {
                    UserPoolId = UserPool.UserPoolId,
                    Domain = hostedUiDomainPrefix
                });
                cognitoDomainValue = hostedUiDomainPrefix;
            }
            
            // Create Native Client (for future mobile apps)
            NativeClient = new UserPoolClient(this, "NativeClient", new UserPoolClientProps
            {
                UserPool = UserPool,
                UserPoolClientName = $"{config.Prefix}-mobile-{config.Name}",
                
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
                IdentityPoolName = $"{config.Prefix}_identity_{config.Name}",
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
                Value = cognitoDomainValue,
                Description = "Cognito domain (custom or prefix)",
                ExportName = $"{config.Name}-cognito-domain-prefix"
            });

            // =============================================================================
            // COGNITO LAMBDA TRIGGERS
            // =============================================================================

            // Note: COGNITO_USER_POOL_ID is not included here to avoid circular dependency.
            // Trigger Lambdas receive the userPoolId in the event object instead.
            var triggerEnvVars = new Dictionary<string, string>
            {
                { "USER_PROFILES_TABLE", UserProfilesTable.TableName },
                { "ACTIVITY_LOG_TABLE", ActivityLogTable.TableName },
                { "INVITATIONS_TABLE", InvitationsTable.TableName },
                { "ENVIRONMENT", config.Name }
            };

            // IAM role for trigger Lambdas (needs Cognito admin + DynamoDB access)
            var triggerRole = new Role(this, "CognitoTriggerRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
                }
            });

            UserProfilesTable.GrantReadWriteData(triggerRole);
            ActivityLogTable.GrantReadWriteData(triggerRole);
            InvitationsTable.GrantReadData(triggerRole);

            // Pre Sign-Up trigger — links federated identities to existing users
            var preSignUpFunction = new LambdaFunction(this, "PreSignUpFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-pre-signup",
                Runtime = Runtime.NODEJS_20_X,
                Handler = "auth/auth-pre-signup.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = triggerRole,
                Environment = triggerEnvVars,
                Timeout = Duration.Seconds(10),
                MemorySize = 256
            });

            // Pre Sign-Up needs Cognito admin permissions to list users and link providers
            preSignUpFunction.AddToRolePolicy(new PolicyStatement(new PolicyStatementProps
            {
                Actions = new[] {
                    "cognito-idp:ListUsers",
                    "cognito-idp:AdminLinkProviderForUser"
                },
                Resources = new[] { UserPool.UserPoolArn }
            }));

            // Post Confirmation trigger — activates user profile
            var postConfirmationFunction = new LambdaFunction(this, "PostConfirmationFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-post-confirmation",
                Runtime = Runtime.NODEJS_20_X,
                Handler = "auth/auth-post-confirmation.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = triggerRole,
                Environment = triggerEnvVars,
                Timeout = Duration.Seconds(10),
                MemorySize = 256
            });

            // Pre Token Generation trigger — adds custom claims to JWT
            var preTokenGenFunction = new LambdaFunction(this, "PreTokenGenFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-pre-token-gen",
                Runtime = Runtime.NODEJS_20_X,
                Handler = "auth/auth-pre-token-generation.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = triggerRole,
                Environment = triggerEnvVars,
                Timeout = Duration.Seconds(10),
                MemorySize = 256
            });

            // Custom Message trigger — customizes email templates
            var customMessageFunction = new LambdaFunction(this, "CustomMessageFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-custom-message",
                Runtime = Runtime.NODEJS_20_X,
                Handler = "auth/auth-custom-message.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = triggerRole,
                Environment = triggerEnvVars,
                Timeout = Duration.Seconds(10),
                MemorySize = 256
            });

            // Trigger wiring is done by the deploy script after CDK deploy,
            // because wiring them in CloudFormation creates circular dependencies
            // (UserPool ↔ Lambda ↔ API Gateway ↔ Cognito Authorizer ↔ UserPool).
            // The deploy script calls `aws cognito-idp update-user-pool` to attach triggers
            // and `aws lambda add-permission` to grant invoke permissions.

            // =============================================================================
            // GOOGLE IDENTITY PROVIDER
            // Optional — reads credentials from Secrets Manager secret:
            //   {prefix}/{environment}/google-oauth
            // with JSON keys: { "clientId": "...", "clientSecret": "..." }
            // Create the secret manually, then CDK picks it up automatically.
            // =============================================================================

            if (config.EnableGoogleLogin)
            {
                var googleSecretName = $"{config.Prefix}/{config.Name}/google-oauth";
                var googleSecret = Secret.FromSecretNameV2(this, "GoogleOAuthSecret", googleSecretName);

                var googleProvider = new UserPoolIdentityProviderGoogle(this, "GoogleProvider", new UserPoolIdentityProviderGoogleProps
                {
                    UserPool = UserPool,
                    ClientId = googleSecret.SecretValueFromJson("clientId").UnsafeUnwrap(),
                    ClientSecretValue = googleSecret.SecretValueFromJson("clientSecret"),
                    Scopes = new[] { "openid", "email", "profile" },
                    AttributeMapping = new AttributeMapping
                    {
                        Email = ProviderAttribute.GOOGLE_EMAIL,
                        GivenName = ProviderAttribute.GOOGLE_GIVEN_NAME,
                        FamilyName = ProviderAttribute.GOOGLE_FAMILY_NAME
                    }
                });

                // WebClient must wait for GoogleProvider to exist before listing it
                // as a supported identity provider. Use L1 dependency to avoid
                // pulling the entire construct tree into the dependency chain.
                var cfnWebClient = (CfnUserPoolClient)WebClient.Node.DefaultChild;
                var cfnGoogleProvider = (CfnUserPoolIdentityProvider)googleProvider.Node.DefaultChild;
                cfnWebClient.AddDependency(cfnGoogleProvider);
            }
            
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
                BucketName = $"{config.Prefix}-pages-{config.Name}",
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
                TableName = $"{config.Prefix}-user-profiles-{config.Name}",
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
                TableName = $"{config.Prefix}-invitations-{config.Name}",
                PartitionKey = new Attribute { Name = "inviteCode", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                Encryption = TableEncryption.AWS_MANAGED,
                TimeToLiveAttribute = "expiresAt" // Auto-delete expired invitations (Unix timestamp)
            });
            
            // Page Links table - for backlinks tracking
            PageLinksTable = new Table(this, "PageLinksTable", new TableProps
            {
                TableName = $"{config.Prefix}-page-links-{config.Name}",
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
                TableName = $"{config.Prefix}-activity-log-{config.Name}",
                PartitionKey = new Attribute { Name = "userId", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "timestamp", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                TimeToLiveAttribute = "expiresAt" // Auto-delete old logs (90 days, Unix timestamp)
            });
            
            // Page Index table - GUID to S3 key mapping
            // Eliminates full bucket scans in findPageKey()
            PageIndexTable = new Table(this, "PageIndexTable", new TableProps
            {
                TableName = $"{config.Prefix}-page-index-{config.Name}",
                PartitionKey = new Attribute { Name = "guid", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });

            // Tags table - vocabulary for tag autocomplete
            // PK: scope (e.g. "_page" for page-level tags, or property name for property tags)
            // SK: tag (the tag value)
            TagsTable = new Table(this, "TagsTable", new TableProps
            {
                TableName = $"{config.Prefix}-tags-{config.Name}",
                PartitionKey = new Attribute { Name = "scope", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "tag", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });

            // Page Types table - type definitions for structured pages
            // PK: guid (UUID v4)
            PageTypesTable = new Table(this, "PageTypesTable", new TableProps
            {
                TableName = $"{config.Prefix}-page-types-{config.Name}",
                PartitionKey = new Attribute { Name = "guid", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });

            // Database Stack outputs
            new CfnOutput(this, "PageTypesTableName", new CfnOutputProps
            {
                Value = PageTypesTable.TableName,
                Description = "DynamoDB table for page type definitions",
                ExportName = $"{config.Name}-page-types-table"
            });

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

            new CfnOutput(this, "PageIndexTableName", new CfnOutputProps
            {
                Value = PageIndexTable.TableName,
                Description = "DynamoDB table for page GUID to S3 key index",
                ExportName = $"{config.Name}-page-index-table"
            });

            new CfnOutput(this, "TagsTableName", new CfnOutputProps
            {
                Value = TagsTable.TableName,
                Description = "DynamoDB table for tag vocabulary/autocomplete",
                ExportName = $"{config.Name}-tags-table"
            });
        }
        
        private void CreateComputeResources(EnvironmentConfig config)
        {
            // Create JWT secret in Secrets Manager
            JwtSecret = new Secret(this, "JwtSecret", new SecretProps
            {
                SecretName = $"{config.Prefix}/{config.Name}/jwt-secret",
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
                RestApiName = $"{config.Prefix}-api-{config.Name}",
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

            // API Gateway custom domain
            if (!string.IsNullOrWhiteSpace(config.CertificateArnRegional) && !string.IsNullOrWhiteSpace(config.DomainName))
            {
                var apiDomainName = $"api.{config.DomainName}";
                var regionalCert = Certificate.FromCertificateArn(this, "ApiRegionalCert", config.CertificateArnRegional);

                var customDomain = Api.AddDomainName("ApiCustomDomain", new DomainNameOptions
                {
                    DomainName = apiDomainName,
                    Certificate = regionalCert,
                    EndpointType = EndpointType.REGIONAL,
                    SecurityPolicy = Amazon.CDK.AWS.APIGateway.SecurityPolicy.TLS_1_2
                });

                new CfnOutput(this, "ApiCustomDomainTarget", new CfnOutputProps
                {
                    Value = customDomain.DomainNameAliasDomainName,
                    Description = "API Gateway custom domain target (create CNAME to this)",
                    ExportName = $"{config.Name}-api-custom-domain-target"
                });

                new CfnOutput(this, "ApiCustomDomainName", new CfnOutputProps
                {
                    Value = apiDomainName,
                    Description = "API custom domain name",
                    ExportName = $"{config.Name}-api-custom-domain"
                });
            }

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
            PageIndexTable.GrantReadWriteData(lambdaRole);
            TagsTable.GrantReadWriteData(lambdaRole);
            PageTypesTable.GrantReadWriteData(lambdaRole);

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
                { "PAGE_INDEX_TABLE", PageIndexTable.TableName },
                { "TAGS_TABLE", TagsTable.TableName },
                { "PAGE_TYPES_TABLE", PageTypesTable.TableName },
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-create",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-get",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-update",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-delete",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-list-children",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-move",
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
            
            var pagesReorderFunction = new LambdaFunction(this, "PagesReorderFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-reorder",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-reorder.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Reorder sibling pages under a shared parent"
            });

            var pagesSearchFunction = new LambdaFunction(this, "PagesSearchFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-search",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-backlinks",
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

            var pagesAncestorsFunction = new LambdaFunction(this, "PagesAncestorsFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-ancestors",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-ancestors.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get ancestor pages for breadcrumb navigation"
            });

            var pagesAttachmentsUploadFunction = new LambdaFunction(this, "PagesAttachmentsUploadFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-attachments-upload",
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

            var pagesAttachmentsPresignFunction = new LambdaFunction(this, "PagesAttachmentsPresignFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-attachments-presign",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-attachments-presign.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Generate presigned URL for attachment upload"
            });

            var pagesAttachmentsConfirmFunction = new LambdaFunction(this, "PagesAttachmentsConfirmFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-attachments-confirm",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/pages-attachments-confirm.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Confirm attachment upload and save metadata"
            });

            var pagesAttachmentsDownloadFunction = new LambdaFunction(this, "PagesAttachmentsDownloadFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-attachments-download",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-attachments-list",
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
                FunctionName = $"{config.Prefix}-{config.Name}-pages-attachments-delete",
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
            
            var tagsListFunction = new LambdaFunction(this, "TagsListFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-tags-list",
                Runtime = lambdaProps.Runtime,
                Handler = "tags/tags-list.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "List tags for autocomplete"
            });

            var tagsCreateFunction = new LambdaFunction(this, "TagsCreateFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-tags-create",
                Runtime = lambdaProps.Runtime,
                Handler = "tags/tags-create.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Create a new tag"
            });

            // =============================================================================
            // Page Types Lambda Functions
            // =============================================================================

            var pageTypesListFunction = new LambdaFunction(this, "PageTypesListFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-page-types-list",
                Runtime = lambdaProps.Runtime,
                Handler = "page-types/page-types-list.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "List all page type definitions"
            });

            var pageTypesGetFunction = new LambdaFunction(this, "PageTypesGetFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-page-types-get",
                Runtime = lambdaProps.Runtime,
                Handler = "page-types/page-types-get.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get a page type definition by GUID"
            });

            var pageTypesCreateFunction = new LambdaFunction(this, "PageTypesCreateFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-page-types-create",
                Runtime = lambdaProps.Runtime,
                Handler = "page-types/page-types-create.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Create a new page type definition"
            });

            var pageTypesUpdateFunction = new LambdaFunction(this, "PageTypesUpdateFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-page-types-update",
                Runtime = lambdaProps.Runtime,
                Handler = "page-types/page-types-update.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Update a page type definition"
            });

            var pageTypesDeleteFunction = new LambdaFunction(this, "PageTypesDeleteFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-page-types-delete",
                Runtime = lambdaProps.Runtime,
                Handler = "page-types/page-types-delete.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Delete a page type definition"
            });

            var pageTypesAllowedChildrenFunction = new LambdaFunction(this, "PageTypesAllowedChildrenFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-page-types-allowed-children",
                Runtime = lambdaProps.Runtime,
                Handler = "page-types/page-types-allowed-children.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get allowed child types for a page type"
            });

            // =============================================================================
            // Auth Lambda Functions (register, me)
            // =============================================================================

            var authRegisterFunction = new LambdaFunction(this, "AuthRegisterFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-register",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/auth-register.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Register new user with invitation code"
            });

            var authMeFunction = new LambdaFunction(this, "AuthMeFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-me",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/auth-me.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get current user profile"
            });

            // =============================================================================
            // Admin Invitation Lambda Functions
            // =============================================================================

            var adminCreateInvitationFunction = new LambdaFunction(this, "AdminCreateInvitationFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-create-invitation",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-create-invitation.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Create invitation code (admin only)"
            });

            var adminListInvitationsFunction = new LambdaFunction(this, "AdminListInvitationsFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-list-invitations",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-list-invitations.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "List invitation codes (admin only)"
            });

            var adminRevokeInvitationFunction = new LambdaFunction(this, "AdminRevokeInvitationFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-revoke-invitation",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-revoke-invitation.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Revoke invitation code (admin only)"
            });

            // =============================================================================
            // Pages Links Resolve Lambda Function
            // =============================================================================

            var pagesLinksResolveFunction = new LambdaFunction(this, "PagesLinksResolveFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-links-resolve",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/links-resolve.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Resolve page links by title"
            });

            // =============================================================================
            // Admin User Management Lambda Functions
            // =============================================================================

            var adminUsersListFunction = new LambdaFunction(this, "AdminUsersListFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-users-list",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-users-list.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "List all users (admin only)"
            });

            var adminUsersGetFunction = new LambdaFunction(this, "AdminUsersGetFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-users-get",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-users-get.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Get user details (admin only)"
            });

            var adminUsersUpdateFunction = new LambdaFunction(this, "AdminUsersUpdateFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-users-update",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-users-update.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Update user role or display name (admin only)"
            });

            var adminUsersSuspendFunction = new LambdaFunction(this, "AdminUsersSuspendFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-users-suspend",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-users-suspend.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Suspend a user (admin only)"
            });

            var adminUsersActivateFunction = new LambdaFunction(this, "AdminUsersActivateFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-users-activate",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-users-activate.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Activate a suspended user (admin only)"
            });

            var adminUsersDeleteFunction = new LambdaFunction(this, "AdminUsersDeleteFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-users-delete",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/admin-users-delete.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Delete a user (admin only)"
            });

            // =============================================================================
            // Self-Service Profile Lambda Functions
            // =============================================================================

            var authProfileUpdateFunction = new LambdaFunction(this, "AuthProfileUpdateFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-profile-update",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/auth-profile-update.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Update own display name"
            });

            var authChangePasswordFunction = new LambdaFunction(this, "AuthChangePasswordFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-change-password",
                Runtime = lambdaProps.Runtime,
                Handler = "auth/auth-change-password.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Change own password"
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

            // GET /pages/{guid}/ancestors - Get ancestor pages for breadcrumbs
            var ancestorsResource = pageGuidResource.AddResource("ancestors");
            ancestorsResource.AddMethod("GET", new LambdaIntegration(pagesAncestorsFunction), new MethodOptions
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

            // POST /pages/links/resolve - Resolve page links by title
            var linksResource = pagesResource.AddResource("links");
            var linksResolveResource = linksResource.AddResource("resolve");
            linksResolveResource.AddMethod("POST", new LambdaIntegration(pagesLinksResolveFunction), new MethodOptions
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

            // PUT /pages/reorder - Reorder sibling pages
            var reorderResource = pagesResource.AddResource("reorder");
            reorderResource.AddMethod("PUT", new LambdaIntegration(pagesReorderFunction), new MethodOptions
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

            // POST /pages/{guid}/attachments/presign - Get presigned upload URL
            var attachmentsPresignResource = attachmentsResource.AddResource("presign");
            attachmentsPresignResource.AddMethod("POST", new LambdaIntegration(pagesAttachmentsPresignFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /pages/{guid}/attachments/confirm - Confirm upload and save metadata
            var attachmentsConfirmResource = attachmentsResource.AddResource("confirm");
            attachmentsConfirmResource.AddMethod("POST", new LambdaIntegration(pagesAttachmentsConfirmFunction), new MethodOptions
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
            
            // =============================================================================
            // API Gateway Routes - /tags
            // =============================================================================

            var tagsResource = Api.Root.AddResource("tags");

            // GET /tags - List tags for autocomplete
            tagsResource.AddMethod("GET", new LambdaIntegration(tagsListFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /tags - Create a new tag
            tagsResource.AddMethod("POST", new LambdaIntegration(tagsCreateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // =============================================================================
            // API Gateway Routes - /page-types
            // =============================================================================

            var pageTypesResource = Api.Root.AddResource("page-types");

            // GET /page-types - List all page type definitions
            pageTypesResource.AddMethod("GET", new LambdaIntegration(pageTypesListFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /page-types - Create a new page type definition
            pageTypesResource.AddMethod("POST", new LambdaIntegration(pageTypesCreateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // /page-types/{guid} resource
            var pageTypeGuidResource = pageTypesResource.AddResource("{guid}");

            // GET /page-types/{guid} - Get a page type definition
            pageTypeGuidResource.AddMethod("GET", new LambdaIntegration(pageTypesGetFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // PUT /page-types/{guid} - Update a page type definition
            pageTypeGuidResource.AddMethod("PUT", new LambdaIntegration(pageTypesUpdateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // DELETE /page-types/{guid} - Delete a page type definition
            pageTypeGuidResource.AddMethod("DELETE", new LambdaIntegration(pageTypesDeleteFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // GET /page-types/{guid}/allowed-children - Get allowed child types
            var allowedChildrenResource = pageTypeGuidResource.AddResource("allowed-children");
            allowedChildrenResource.AddMethod("GET", new LambdaIntegration(pageTypesAllowedChildrenFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // =============================================================================
            // API Gateway Routes - /admin/users
            // =============================================================================

            var adminResource = Api.Root.AddResource("admin");
            var adminUsersResource = adminResource.AddResource("users");

            // GET /admin/users - List all users
            adminUsersResource.AddMethod("GET", new LambdaIntegration(adminUsersListFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // /admin/users/{userId} resource
            var adminUserIdResource = adminUsersResource.AddResource("{userId}");

            // GET /admin/users/{userId} - Get user details
            adminUserIdResource.AddMethod("GET", new LambdaIntegration(adminUsersGetFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // PUT /admin/users/{userId} - Update user
            adminUserIdResource.AddMethod("PUT", new LambdaIntegration(adminUsersUpdateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // DELETE /admin/users/{userId} - Delete user
            adminUserIdResource.AddMethod("DELETE", new LambdaIntegration(adminUsersDeleteFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /admin/users/{userId}/suspend - Suspend user
            var adminUserSuspendResource = adminUserIdResource.AddResource("suspend");
            adminUserSuspendResource.AddMethod("POST", new LambdaIntegration(adminUsersSuspendFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /admin/users/{userId}/activate - Activate user
            var adminUserActivateResource = adminUserIdResource.AddResource("activate");
            adminUserActivateResource.AddMethod("POST", new LambdaIntegration(adminUsersActivateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // =============================================================================
            // API Gateway Routes - /admin/invitations
            // =============================================================================

            var adminInvitationsResource = adminResource.AddResource("invitations");

            // GET /admin/invitations - List invitations
            adminInvitationsResource.AddMethod("GET", new LambdaIntegration(adminListInvitationsFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /admin/invitations - Create invitation
            adminInvitationsResource.AddMethod("POST", new LambdaIntegration(adminCreateInvitationFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // /admin/invitations/{invitationCode}
            var adminInvitationCodeResource = adminInvitationsResource.AddResource("{invitationCode}");

            // DELETE /admin/invitations/{invitationCode} - Revoke invitation
            adminInvitationCodeResource.AddMethod("DELETE", new LambdaIntegration(adminRevokeInvitationFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // =============================================================================
            // API Gateway Routes - /auth/profile and /auth/change-password
            // =============================================================================

            var authResource = Api.Root.AddResource("auth");

            // POST /auth/register - Register new user (public, no auth required)
            var authRegisterResource = authResource.AddResource("register");
            authRegisterResource.AddMethod("POST", new LambdaIntegration(authRegisterFunction));

            // GET /auth/me - Get current user profile
            var authMeResource = authResource.AddResource("me");
            authMeResource.AddMethod("GET", new LambdaIntegration(authMeFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // PUT /auth/profile - Update own profile
            var authProfileResource = authResource.AddResource("profile");
            authProfileResource.AddMethod("PUT", new LambdaIntegration(authProfileUpdateFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // POST /auth/change-password - Change own password
            var authChangePasswordResource = authResource.AddResource("change-password");
            authChangePasswordResource.AddMethod("POST", new LambdaIntegration(authChangePasswordFunction), new MethodOptions
            {
                AuthorizationType = AuthorizationType.COGNITO,
                Authorizer = cognitoAuthorizer
            });

            // =============================================================================
            // MCP Server (AI Access)
            // =============================================================================

            // Dedicated read-only IAM role for MCP Lambda
            var mcpLambdaRole = new Role(this, "McpLambdaExecutionRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                    ManagedPolicy.FromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
                }
            });

            // Read/write grants for page updates; read-only for types
            PagesBucket.GrantReadWrite(mcpLambdaRole);
            PageLinksTable.GrantReadWriteData(mcpLambdaRole);
            PageIndexTable.GrantReadWriteData(mcpLambdaRole);
            PageTypesTable.GrantReadData(mcpLambdaRole);

            // S3 Vectors for semantic search (derived data — DESTROY on stack deletion)
            var vectorBucketName = $"{config.Prefix}-vectors-{config.Name}";
            var vectorIndexName = "wiki-pages";
            var stackRegion = Stack.Of(this).Region;

            var vectorBucket = new Amazon.CDK.CfnResource(this, "VectorBucket", new Amazon.CDK.CfnResourceProps
            {
                Type = "AWS::S3Vectors::VectorBucket",
                Properties = new Dictionary<string, object>
                {
                    ["VectorBucketName"] = vectorBucketName
                }
            });
            vectorBucket.ApplyRemovalPolicy(RemovalPolicy.DESTROY);

            var vectorIndex = new Amazon.CDK.CfnResource(this, "VectorIndex", new Amazon.CDK.CfnResourceProps
            {
                Type = "AWS::S3Vectors::Index",
                Properties = new Dictionary<string, object>
                {
                    ["VectorBucketName"] = vectorBucketName,
                    ["IndexName"] = vectorIndexName,
                    ["DataType"] = "float32",
                    ["Dimension"] = 256,
                    ["DistanceMetric"] = "cosine"
                }
            });
            vectorIndex.AddDependency(vectorBucket);

            // MCP Lambda needs S3 Vectors query + Bedrock embed permissions
            mcpLambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Effect = Effect.ALLOW,
                Actions = new[] { "s3vectors:QueryVectors" },
                Resources = new[] { $"arn:aws:s3vectors:{stackRegion}:*:bucket/{vectorBucketName}/*" }
            }));
            mcpLambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Effect = Effect.ALLOW,
                Actions = new[] { "bedrock:InvokeModel" },
                Resources = new[] { $"arn:aws:bedrock:{stackRegion}::foundation-model/amazon.titan-embed-text-v2:0" }
            }));

            var mcpEnvVars = new Dictionary<string, string>
            {
                { "PAGES_BUCKET", PagesBucket.BucketName },
                { "PAGE_LINKS_TABLE", PageLinksTable.TableName },
                { "PAGE_TYPES_TABLE", PageTypesTable.TableName },
                { "PAGE_INDEX_TABLE", PageIndexTable.TableName },
                { "VECTOR_BUCKET_NAME", vectorBucketName },
                { "VECTOR_INDEX_NAME", vectorIndexName },
                { "EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0" },
                { "ENVIRONMENT", config.Name }
            };

            var mcpFunction = new LambdaFunction(this, "McpFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-mcp",
                Runtime = Runtime.NODEJS_20_X,
                Handler = "mcp/mcp-handler.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = mcpLambdaRole,
                Environment = mcpEnvVars,
                Timeout = Duration.Seconds(30),
                MemorySize = 512,
                Tracing = Tracing.ACTIVE,
                LogRetention = (RetentionDays)config.LogRetentionDays,
                Description = "MCP server for AI read/write access to wiki pages"
            });

            // API Gateway route: /mcp (POST and GET) with API key auth
            var mcpResource = Api.Root.AddResource("mcp");

            mcpResource.AddMethod("POST", new LambdaIntegration(mcpFunction), new MethodOptions
            {
                ApiKeyRequired = true
            });

            mcpResource.AddMethod("GET", new LambdaIntegration(mcpFunction), new MethodOptions
            {
                ApiKeyRequired = true
            });

            // Usage plan and API key for MCP access
            var mcpApiKey = Api.AddApiKey("McpApiKey", new ApiKeyOptions
            {
                ApiKeyName = $"{config.Prefix}-mcp-key-{config.Name}",
                Description = "API key for MCP AI access to BlueFinWiki"
            });

            var mcpUsagePlan = Api.AddUsagePlan("McpUsagePlan", new UsagePlanProps
            {
                Name = $"{config.Prefix}-mcp-plan-{config.Name}",
                Description = "Usage plan for MCP AI access",
                Throttle = new ThrottleSettings
                {
                    RateLimit = 10,
                    BurstLimit = 20
                }
            });

            mcpUsagePlan.AddApiKey(mcpApiKey);
            mcpUsagePlan.AddApiStage(new UsagePlanPerApiStage
            {
                Api = Api,
                Stage = Api.DeploymentStage
            });

            new CfnOutput(this, "McpApiKeyId", new CfnOutputProps
            {
                Value = mcpApiKey.KeyId,
                Description = "MCP API Key ID (use 'aws apigateway get-api-key --api-key <id> --include-value' to retrieve the key value)",
                ExportName = $"{config.Name}-mcp-api-key-id"
            });

            // =============================================================================
            // Vector Index Builder (Semantic Search)
            // =============================================================================

            var vectorIndexBuilderRole = new Role(this, "VectorIndexBuilderRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                    ManagedPolicy.FromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
                }
            });

            // Read pages from S3, read page index for path building
            PagesBucket.GrantRead(vectorIndexBuilderRole);
            PageIndexTable.GrantReadData(vectorIndexBuilderRole);

            // S3 Vectors write permissions
            vectorIndexBuilderRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Effect = Effect.ALLOW,
                Actions = new[] { "s3vectors:PutVectors", "s3vectors:DeleteVectors" },
                Resources = new[] { $"arn:aws:s3vectors:{stackRegion}:*:bucket/{vectorBucketName}/*" }
            }));

            // Bedrock embedding permissions
            vectorIndexBuilderRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Effect = Effect.ALLOW,
                Actions = new[] { "bedrock:InvokeModel" },
                Resources = new[] { $"arn:aws:bedrock:{stackRegion}::foundation-model/amazon.titan-embed-text-v2:0" }
            }));

            var vectorIndexBuilderEnvVars = new Dictionary<string, string>
            {
                { "PAGES_BUCKET", PagesBucket.BucketName },
                { "S3_PAGES_BUCKET", PagesBucket.BucketName },
                { "PAGE_INDEX_TABLE", PageIndexTable.TableName },
                { "VECTOR_BUCKET_NAME", vectorBucketName },
                { "VECTOR_INDEX_NAME", vectorIndexName },
                { "EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0" },
                { "ENVIRONMENT", config.Name }
            };

            var vectorIndexBuilderFunction = new LambdaFunction(this, "VectorIndexBuilderFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-vector-index-builder",
                Runtime = Runtime.NODEJS_20_X,
                Handler = "search/vector-index-builder.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = vectorIndexBuilderRole,
                Environment = vectorIndexBuilderEnvVars,
                Timeout = Duration.Minutes(5),
                MemorySize = 512,
                Tracing = Tracing.ACTIVE,
                LogRetention = (RetentionDays)config.LogRetentionDays,
                Description = "Maintains S3 Vectors index for semantic search — triggered by S3 page events"
            });

            // Trigger on page create/update/delete in S3
            PagesBucket.AddEventNotification(
                EventType.OBJECT_CREATED,
                new LambdaDestination(vectorIndexBuilderFunction),
                new NotificationKeyFilter { Suffix = ".md" }
            );
            PagesBucket.AddEventNotification(
                EventType.OBJECT_REMOVED,
                new LambdaDestination(vectorIndexBuilderFunction),
                new NotificationKeyFilter { Suffix = ".md" }
            );

            // Compute Stack outputs
            var apiUrl = !string.IsNullOrWhiteSpace(config.DomainName)
                ? $"https://api.{config.DomainName}/"
                : Api.UrlForPath("/");

            new CfnOutput(this, "ApiUrl", new CfnOutputProps
            {
                Value = apiUrl,
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
                BucketName = $"{config.Prefix}-frontend-{config.Name}",
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
                CachePolicyName = $"{config.Prefix}-static-{config.Name}",
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
                CachePolicyName = $"{config.Prefix}-no-cache-{config.Name}",
                Comment = "No cache policy for SPA routing",
                DefaultTtl = Duration.Seconds(0),
                MinTtl = Duration.Seconds(0),
                MaxTtl = Duration.Seconds(0)
            });
            
            // CloudFront certificate (must be in us-east-1)
            ICertificate cloudfrontCert = null;
            if (!string.IsNullOrWhiteSpace(config.CertificateArnUsEast1) && !string.IsNullOrWhiteSpace(config.DomainName))
            {
                cloudfrontCert = Certificate.FromCertificateArn(this, "CloudFrontCert", config.CertificateArnUsEast1);
            }

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
                DomainNames = cloudfrontCert != null ? new[] { config.DomainName } : null,
                Certificate = cloudfrontCert,

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
            // Custom domain takes priority
            if (!string.IsNullOrWhiteSpace(config.DomainName))
            {
                return $"https://{config.DomainName.Trim().TrimEnd('/')}";
            }

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
            return $"{config.Prefix}-{config.Name}-{Aws.ACCOUNT_ID}";
        }
    }
}
