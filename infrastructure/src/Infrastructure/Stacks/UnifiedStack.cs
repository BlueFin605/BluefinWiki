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
using Constructs;
using System.Collections.Generic;
using LambdaFunction = Amazon.CDK.AWS.Lambda.Function;
using LambdaFunctionProps = Amazon.CDK.AWS.Lambda.FunctionProps;
using CloudFrontDistribution = Amazon.CDK.AWS.CloudFront.Distribution;
// Aliased rather than imported wholesale: Apigatewayv2 shares type names
// (DomainNameOptions, EndpointType, SecurityPolicy...) with AWS.APIGateway.
using WebSocketApi = Amazon.CDK.AWS.Apigatewayv2.WebSocketApi;
using WebSocketApiProps = Amazon.CDK.AWS.Apigatewayv2.WebSocketApiProps;
using WebSocketStage = Amazon.CDK.AWS.Apigatewayv2.WebSocketStage;
using WebSocketStageProps = Amazon.CDK.AWS.Apigatewayv2.WebSocketStageProps;
using WebSocketRouteOptions = Amazon.CDK.AWS.Apigatewayv2.WebSocketRouteOptions;
using WebSocketThrottleSettings = Amazon.CDK.AWS.Apigatewayv2.ThrottleSettings;
using WebSocketLambdaIntegration = Amazon.CDK.AwsApigatewayv2Integrations.WebSocketLambdaIntegration;

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
        public Table TicketKeysTable { get; private set; }
        public Table TagsTable { get; private set; }
        public Table PageTypesTable { get; private set; }
        public Table RealtimeConnectionsTable { get; private set; }

        // Compute resources
        public RestApi Api { get; private set; }
        // JWT signing secret lives in SSM SecureString at /{prefix}/{name}/jwt-secret.
        // The deploy script bootstraps the parameter on first run; CDK references the
        // path only.
        public string JwtParameterName { get; private set; }

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
                
                // Email configuration — SES if configured, otherwise Cognito default (50/day cap)
                Email = BuildUserPoolEmail(config),
                
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
                AccessTokenValidity = Duration.Minutes(30),
                IdTokenValidity = Duration.Minutes(30),
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
                
                AccessTokenValidity = Duration.Minutes(30),
                IdTokenValidity = Duration.Minutes(30),
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
            InvitationsTable.GrantReadWriteData(triggerRole);

            // Pre Sign-Up trigger — links federated identities to existing users
            var preSignUpFunction = new LambdaFunction(this, "PreSignUpFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-pre-signup",
                Runtime = Runtime.NODEJS_24_X,
                Handler = "auth/auth-pre-signup.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = triggerRole,
                Environment = triggerEnvVars,
                Timeout = Duration.Seconds(10),
                MemorySize = 256
            });

            // Pre Sign-Up needs Cognito admin permissions to list users and link providers.
            // Use a constructed wildcard ARN rather than UserPool.UserPoolArn — pinning the
            // token would create a CFN cycle once we attach the Lambda as a UserPool trigger
            // below (UserPool → Lambda → Role → UserPool).
            preSignUpFunction.AddToRolePolicy(new PolicyStatement(new PolicyStatementProps
            {
                Actions = new[] {
                    "cognito-idp:ListUsers",
                    "cognito-idp:AdminLinkProviderForUser"
                },
                Resources = new[] { $"arn:aws:cognito-idp:{Region}:{Account}:userpool/*" }
            }));

            // Post Confirmation trigger — activates user profile
            var postConfirmationFunction = new LambdaFunction(this, "PostConfirmationFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-auth-post-confirmation",
                Runtime = Runtime.NODEJS_24_X,
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
                Runtime = Runtime.NODEJS_24_X,
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
                Runtime = Runtime.NODEJS_24_X,
                Handler = "auth/auth-custom-message.handler",
                Code = Code.FromAsset("../backend/dist"),
                Role = triggerRole,
                Environment = triggerEnvVars,
                Timeout = Duration.Seconds(10),
                MemorySize = 256
            });

            // Attach trigger Lambdas to the User Pool. AddTrigger also adds the
            // lambda:InvokeFunction permission for cognito-idp.amazonaws.com automatically.
            // The trigger Lambdas deliberately do NOT receive COGNITO_USER_POOL_ID as an env
            // var (they read userPoolId off the event) and their role policy uses a
            // constructed userpool/* ARN, so there is no Lambda → UserPool dependency edge —
            // breaking what would otherwise be a UserPool ↔ Lambda CFN cycle.
            UserPool.AddTrigger(UserPoolOperation.PRE_SIGN_UP, preSignUpFunction);
            UserPool.AddTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmationFunction);
            UserPool.AddTrigger(UserPoolOperation.PRE_TOKEN_GENERATION, preTokenGenFunction);
            UserPool.AddTrigger(UserPoolOperation.CUSTOM_MESSAGE, customMessageFunction);

            // =============================================================================
            // GOOGLE IDENTITY PROVIDER
            // Optional — real credentials live in SSM SecureString at
            //   /{prefix}/{environment}/google-oauth
            // with JSON keys: { "clientId": "...", "clientSecret": "..." }
            // CDK creates the IdP with placeholder credentials; deploy-infra.ps1 runs
            // `aws cognito-idp update-identity-provider` post-deploy to inject the
            // live values. This avoids CFN SecureString version pinning and lets
            // rotation propagate without a CDK redeploy.
            // =============================================================================

            if (config.EnableGoogleLogin)
            {
                var googleProvider = new UserPoolIdentityProviderGoogle(this, "GoogleProvider", new UserPoolIdentityProviderGoogleProps
                {
                    UserPool = UserPool,
                    ClientId = "PLACEHOLDER_SYNCED_POST_DEPLOY",
                    ClientSecretValue = SecretValue.UnsafePlainText("PLACEHOLDER_SYNCED_POST_DEPLOY"),
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
                        NoncurrentVersionExpiration = Duration.Days(30),
                        ExpiredObjectDeleteMarker = true,
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

            // Ticket keys table - Jira-style ticket keys (BGT-12)
            // id = "seq#{PREFIX}" (atomic counter) | "key#{KEY}" (write-once key -> page GUID)
            TicketKeysTable = new Table(this, "TicketKeysTable", new TableProps
            {
                TableName = $"{config.Prefix}-ticket-keys-{config.Name}",
                PartitionKey = new Attribute { Name = "id", Type = AttributeType.STRING },
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

            // Realtime Connections table - open API Gateway WebSocket connections
            // PK: connectionId. Attributes: userId, expiresAt (Unix seconds).
            // TTL on expiresAt removes rows whose $disconnect never fired. Rows are
            // ephemeral connection ids only, so DESTROY in every environment.
            RealtimeConnectionsTable = new Table(this, "RealtimeConnectionsTable", new TableProps
            {
                TableName = $"{config.Prefix}-realtime-connections-{config.Name}",
                PartitionKey = new Attribute { Name = "connectionId", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                Encryption = TableEncryption.AWS_MANAGED,
                TimeToLiveAttribute = "expiresAt"
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

            new CfnOutput(this, "TicketKeysTableName", new CfnOutputProps
            {
                Value = TicketKeysTable.TableName,
                Description = "DynamoDB table for Kanban ticket keys (counters and key to page GUID mappings)",
                ExportName = $"{config.Name}-ticket-keys-table"
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
            // JWT signing secret lives in SSM SecureString. The deploy script
            // bootstraps the parameter on first deploy (generates 64 random chars,
            // puts as SecureString). CDK only knows the path so it can wire the
            // Lambda env var + IAM grant — the secret value is never in CFN.
            JwtParameterName = $"/{config.Prefix}/{config.Name}/jwt-secret";

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
                    // X-Client-Id: realtime origin id, so a tab can ignore its own change events.
                    AllowHeaders = new[] { "Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token", "X-Access-Token", "X-Client-Id" },
                    AllowCredentials = true
                }
            });

            // Ensure API Gateway-generated errors (timeouts, auth failures, integration errors)
            // still include CORS headers so browsers surface the real status/error.
            var gatewayResponseCorsHeaders = new Dictionary<string, string>
            {
                { "gatewayresponse.header.Access-Control-Allow-Origin", "'*'" },
                { "gatewayresponse.header.Access-Control-Allow-Headers", "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Client-Id'" },
                { "gatewayresponse.header.Access-Control-Allow-Methods", "'GET,POST,PUT,PATCH,DELETE,OPTIONS'" }
            };

            _ = new CfnGatewayResponse(this, "ApiDefault4xxGatewayResponse", new CfnGatewayResponseProps
            {
                RestApiId = Api.RestApiId,
                ResponseType = "DEFAULT_4XX",
                ResponseParameters = gatewayResponseCorsHeaders
            });

            _ = new CfnGatewayResponse(this, "ApiDefault5xxGatewayResponse", new CfnGatewayResponseProps
            {
                RestApiId = Api.RestApiId,
                ResponseType = "DEFAULT_5XX",
                ResponseParameters = gatewayResponseCorsHeaders
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
            TicketKeysTable.GrantReadWriteData(lambdaRole);
            TagsTable.GrantReadWriteData(lambdaRole);
            PageTypesTable.GrantReadWriteData(lambdaRole);

            // Grant Lambda access to the JWT SSM SecureString. SecureString reads
            // require kms:Decrypt against the AWS-managed SSM key; we scope that
            // via the ssm service condition rather than naming the key by ARN.
            lambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Actions = new[] { "ssm:GetParameter" },
                Resources = new[] { $"arn:aws:ssm:{this.Region}:{this.Account}:parameter{JwtParameterName}" }
            }));
            lambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Actions = new[] { "kms:Decrypt" },
                Resources = new[] { "*" },
                Conditions = new Dictionary<string, object>
                {
                    ["StringEquals"] = new Dictionary<string, string>
                    {
                        ["kms:ViaService"] = $"ssm.{this.Region}.amazonaws.com"
                    }
                }
            }));

            // Allow Lambdas to send transactional email (e.g. invitations) from the
            // same verified SES domain used for Cognito's own emails. Scoped to the
            // domain identity rather than account-wide.
            if (!string.IsNullOrWhiteSpace(config.SesFromAddress))
            {
                var sesAtIndex = config.SesFromAddress.IndexOf('@');
                if (sesAtIndex > 0 && sesAtIndex < config.SesFromAddress.Length - 1)
                {
                    var sesVerifiedDomain = config.SesFromAddress.Substring(sesAtIndex + 1);
                    lambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
                    {
                        Actions = new[] { "ses:SendEmail", "ses:SendRawEmail" },
                        Resources = new[]
                        {
                            $"arn:aws:ses:{this.Region}:{this.Account}:identity/{sesVerifiedDomain}"
                        }
                    }));
                }
            }

            // =============================================================================
            // Realtime WebSocket API (change notifications)
            // Created before commonEnvVars because every API Lambda needs its callback
            // URL; the routes are attached further down once the ws-* functions exist.
            // =============================================================================
            var realtimeWsApi = new WebSocketApi(this, "RealtimeWsApi", new WebSocketApiProps
            {
                ApiName = $"{config.Prefix}-ws-{config.Name}",
                Description = $"BlueFinWiki realtime change notifications for {config.Name} environment"
            });

            // Access logging is deliberately left OFF on this stage: the Cognito ID token
            // travels in the $connect query string (?token=), and browsers cannot send
            // headers on a WebSocket, so an access log would record live tokens.
            // Throttle (stage default route settings, applied per route): $connect is
            // unauthenticated at the gateway, so every attempt invokes ws-connect. 20 rps
            // steady / 50 burst is far above a few-user wiki (one connect per tab, a ping
            // every 5 min) while bounding the cost of abuse.
            var realtimeWsStage = new WebSocketStage(this, "RealtimeWsStage", new WebSocketStageProps
            {
                WebSocketApi = realtimeWsApi,
                StageName = "prod",
                AutoDeploy = true,
                Throttle = new WebSocketThrottleSettings
                {
                    RateLimit = 20,
                    BurstLimit = 50
                }
            });

            // https callback (management API) URL the API Lambdas post to — NOT the wss URL.
            var realtimeCallbackUrl = $"https://{realtimeWsApi.ApiId}.execute-api.{this.Region}.amazonaws.com/{realtimeWsStage.StageName}";
            var realtimeClientUrl = $"wss://{realtimeWsApi.ApiId}.execute-api.{this.Region}.amazonaws.com/{realtimeWsStage.StageName}";

            // Least-privilege grants for any role whose Lambdas publish change events:
            // Scan the connection list, DeleteItem gone connections, and POST to
            // @connections on this API's stage only.
            void GrantRealtimePublish(Role role)
            {
                role.AddToPolicy(new PolicyStatement(new PolicyStatementProps
                {
                    Actions = new[] { "dynamodb:Scan", "dynamodb:DeleteItem" },
                    Resources = new[] { RealtimeConnectionsTable.TableArn }
                }));
                role.AddToPolicy(new PolicyStatement(new PolicyStatementProps
                {
                    Actions = new[] { "execute-api:ManageConnections" },
                    Resources = new[]
                    {
                        $"arn:{this.Partition}:execute-api:{this.Region}:{this.Account}:{realtimeWsApi.ApiId}/{realtimeWsStage.StageName}/POST/@connections/*"
                    }
                }));
            }

            GrantRealtimePublish(lambdaRole);

            // S3 Vectors names — deterministic, reused below where the bucket/index are
            // actually created. Declared here so commonEnvVars can ship them to every
            // Lambda that uses vector search (e.g. the api-router for /search).
            var vectorBucketName = $"{config.Prefix}-vectors-{config.Name}";
            var vectorIndexName = "wiki-pages";

            // Common Lambda environment variables
            var commonEnvVars = new Dictionary<string, string>
            {
                { "NODE_OPTIONS", "--enable-source-maps" }, // bundle.mjs ships sourcemaps; readable stack traces
                { "PAGES_BUCKET", PagesBucket.BucketName },
                { "COGNITO_USER_POOL_ID", UserPool.UserPoolId },
                { "COGNITO_CLIENT_ID", WebClient.UserPoolClientId },
                { "USER_PROFILES_TABLE", UserProfilesTable.TableName },
                { "INVITATIONS_TABLE", InvitationsTable.TableName },
                { "PAGE_LINKS_TABLE", PageLinksTable.TableName },
                { "ACTIVITY_LOG_TABLE", ActivityLogTable.TableName },
                { "PAGE_INDEX_TABLE", PageIndexTable.TableName },
                { "TICKET_KEYS_TABLE", TicketKeysTable.TableName },
                { "TAGS_TABLE", TagsTable.TableName },
                { "PAGE_TYPES_TABLE", PageTypesTable.TableName },
                { "JWT_PARAMETER_NAME", JwtParameterName },
                { "VECTOR_BUCKET_NAME", vectorBucketName },
                { "VECTOR_INDEX_NAME", vectorIndexName },
                { "EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0" },
                { "ENVIRONMENT", config.Name },
                { "REALTIME_WS_ENDPOINT", realtimeCallbackUrl },
                { "REALTIME_CONNECTIONS_TABLE", RealtimeConnectionsTable.TableName }
            };

            if (!string.IsNullOrWhiteSpace(config.SesFromAddress))
            {
                commonEnvVars["FROM_EMAIL"] = config.SesFromAddress;
                if (!string.IsNullOrWhiteSpace(config.SesFromName))
                {
                    commonEnvVars["FROM_NAME"] = config.SesFromName;
                }
            }
            
            // Lambda function base configuration
            var lambdaProps = new LambdaFunctionProps
            {
                Runtime = Runtime.NODEJS_24_X,
                Code = Code.FromAsset("../backend/dist"), // Build output directory
                Role = lambdaRole,
                Environment = commonEnvVars,
                Timeout = Duration.Seconds(30),
                MemorySize = 512,
                Tracing = Tracing.ACTIVE,
                LogRetention = (RetentionDays)config.LogRetentionDays
            };

            // =============================================================================
            // Realtime WebSocket Lambda Functions ($connect / $disconnect / $default)
            // Own roles, nothing from the shared lambdaRole: ws-connect / ws-disconnect
            // record and forget connections (PutItem / DeleteItem on the connections table
            // only); ws-default just answers pings (basic execution + X-Ray only).
            // Environment is only what they read: COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID
            // for ws-connect's token check, and REALTIME_CONNECTIONS_TABLE. NODE_ENV must
            // never be "development" here — that switches on the local mock-token bypass.
            // =============================================================================
            var realtimeWsRole = new Role(this, "RealtimeWsLambdaRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                    ManagedPolicy.FromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
                }
            });
            realtimeWsRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Actions = new[] { "dynamodb:PutItem", "dynamodb:DeleteItem" },
                Resources = new[] { RealtimeConnectionsTable.TableArn }
            }));

            var realtimeWsDefaultRole = new Role(this, "RealtimeWsDefaultLambdaRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                    ManagedPolicy.FromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
                }
            });

            var realtimeWsEnvVars = new Dictionary<string, string>
            {
                { "COGNITO_USER_POOL_ID", UserPool.UserPoolId },
                { "COGNITO_CLIENT_ID", WebClient.UserPoolClientId },
                { "REALTIME_CONNECTIONS_TABLE", RealtimeConnectionsTable.TableName }
            };

            LambdaFunction CreateRealtimeWsFunction(string id, string suffix, IRole role, string description)
            {
                return new LambdaFunction(this, id, new LambdaFunctionProps
                {
                    FunctionName = $"{config.Prefix}-{config.Name}-ws-{suffix}",
                    Runtime = lambdaProps.Runtime,
                    Handler = $"realtime/ws-{suffix}.handler",
                    Code = lambdaProps.Code,
                    Role = role,
                    Environment = realtimeWsEnvVars,
                    Timeout = Duration.Seconds(10),
                    MemorySize = 256,
                    Tracing = lambdaProps.Tracing,
                    LogRetention = lambdaProps.LogRetention,
                    Description = description
                });
            }

            var wsConnectFunction = CreateRealtimeWsFunction("RealtimeWsConnectFunction", "connect", realtimeWsRole, "Realtime WebSocket $connect: verify ID token, record connection");
            var wsDisconnectFunction = CreateRealtimeWsFunction("RealtimeWsDisconnectFunction", "disconnect", realtimeWsRole, "Realtime WebSocket $disconnect: forget connection");
            var wsDefaultFunction = CreateRealtimeWsFunction("RealtimeWsDefaultFunction", "default", realtimeWsDefaultRole, "Realtime WebSocket $default: keep-alive pings");

            realtimeWsApi.AddRoute("$connect", new WebSocketRouteOptions
            {
                Integration = new WebSocketLambdaIntegration("RealtimeWsConnectIntegration", wsConnectFunction)
            });
            realtimeWsApi.AddRoute("$disconnect", new WebSocketRouteOptions
            {
                Integration = new WebSocketLambdaIntegration("RealtimeWsDisconnectIntegration", wsDisconnectFunction)
            });
            realtimeWsApi.AddRoute("$default", new WebSocketRouteOptions
            {
                Integration = new WebSocketLambdaIntegration("RealtimeWsDefaultIntegration", wsDefaultFunction)
            });

            new CfnOutput(this, "RealtimeUrl", new CfnOutputProps
            {
                Value = realtimeClientUrl,
                Description = "Realtime WebSocket URL for the SPA (environment.realtimeUrl)",
                ExportName = $"{config.Name}-realtime-url"
            });

            // =============================================================================
            // API router Lambda: serves every REST route except the few routed to their own
            // functions below. Route table: backend/src/router/routes.ts.
            // =============================================================================
            var apiRouterFunction = new LambdaFunction(this, "ApiRouterFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-api-router",
                Runtime = lambdaProps.Runtime,
                Handler = "router/lambda.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = lambdaProps.Timeout,
                MemorySize = lambdaProps.MemorySize,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "API router: dispatches REST routes to the backend handlers"
            });

            // =============================================================================
            // Pages Lambda Functions (Task 3.3)
            // =============================================================================
            
            // Dedicated minimal IAM role for the URL-fetch proxy — defense in depth
            // against SSRF: even if an attacker steers the AI to a private IP somehow,
            // a credential leak from this Lambda yields no AWS access beyond logs.
            var proxyFetchUrlRole = new Role(this, "ProxyFetchUrlRole", new RoleProps
            {
                AssumedBy = new ServicePrincipal("lambda.amazonaws.com"),
                ManagedPolicies = new[]
                {
                    ManagedPolicy.FromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
                }
            });

            var proxyFetchUrlFunction = new LambdaFunction(this, "ProxyFetchUrlFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-proxy-fetch-url",
                Runtime = lambdaProps.Runtime,
                Handler = "proxy/fetch-url.handler",
                Code = lambdaProps.Code,
                Role = proxyFetchUrlRole,
                Environment = new Dictionary<string, string>
                {
                    { "COGNITO_USER_POOL_ID", lambdaProps.Environment["COGNITO_USER_POOL_ID"] },
                    { "COGNITO_CLIENT_ID", lambdaProps.Environment["COGNITO_CLIENT_ID"] },
                    { "ENVIRONMENT", config.Name }
                },
                Timeout = Duration.Seconds(15),
                MemorySize = 256,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "SSRF-hardened URL fetch proxy for the AI assistant"
            });

            var ticketKeysBackfillFunction = new LambdaFunction(this, "TicketKeysBackfillFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-ticket-keys-backfill",
                Runtime = lambdaProps.Runtime,
                Handler = "ticket-keys/ticket-keys-backfill-handler.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = Duration.Minutes(5),
                MemorySize = 1024,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Assign/repair ticket keys under an Initiative (admin only)"
            });

            var boardOrderBackfillFunction = new LambdaFunction(this, "BoardOrderBackfillFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-pages-board-order-backfill",
                Runtime = lambdaProps.Runtime,
                Handler = "pages/board-order-backfill-handler.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = Duration.Minutes(5),
                MemorySize = 1024,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Backfill boardOrder for cards beneath a page (admin only)"
            });

            // =============================================================================
            // Admin: Rebuild Page Index Lambda
            // =============================================================================
            // Walks every page in S3, repopulates the DynamoDB page index, and deletes
            // orphan rows for pages that no longer exist in S3. The cold path here is
            // a full bucket scan when the index is empty, so timeout/memory are higher
            // than the default Lambda config used for normal page operations.
            var adminRebuildPageIndexFunction = new LambdaFunction(this, "AdminRebuildPageIndexFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-admin-rebuild-page-index",
                Runtime = lambdaProps.Runtime,
                Handler = "storage/rebuild-page-index.handler",
                Code = lambdaProps.Code,
                Role = lambdaProps.Role,
                Environment = lambdaProps.Environment,
                Timeout = Duration.Minutes(5),
                MemorySize = 1024,
                Tracing = lambdaProps.Tracing,
                LogRetention = lambdaProps.LogRetention,
                Description = "Rebuild page index from S3 + drop orphan rows (admin only)"
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
            TicketKeysTable.GrantReadWriteData(mcpLambdaRole);
            PageTypesTable.GrantReadData(mcpLambdaRole);

            // MCP page writes go through the same storage plugin, so they publish too.
            GrantRealtimePublish(mcpLambdaRole);

            // S3 Vectors for semantic search (derived data — DESTROY on stack deletion).
            // vectorBucketName and vectorIndexName are declared further up alongside commonEnvVars.
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
                Actions = new[] { "s3vectors:QueryVectors", "s3vectors:GetVectors" },
                Resources = new[] { $"arn:aws:s3vectors:{stackRegion}:*:bucket/{vectorBucketName}/*" }
            }));
            mcpLambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Effect = Effect.ALLOW,
                Actions = new[] { "bedrock:InvokeModel" },
                Resources = new[] { $"arn:aws:bedrock:{stackRegion}::foundation-model/amazon.titan-embed-text-v2:0" }
            }));

            // The shared lambdaRole (used by the api-router for /search) needs the same grants
            lambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
            {
                Effect = Effect.ALLOW,
                Actions = new[] { "s3vectors:QueryVectors", "s3vectors:GetVectors" },
                Resources = new[] { $"arn:aws:s3vectors:{stackRegion}:*:bucket/{vectorBucketName}/*" }
            }));
            lambdaRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps
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
                { "TICKET_KEYS_TABLE", TicketKeysTable.TableName },
                { "VECTOR_BUCKET_NAME", vectorBucketName },
                { "VECTOR_INDEX_NAME", vectorIndexName },
                { "EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0" },
                { "ENVIRONMENT", config.Name },
                { "REALTIME_WS_ENDPOINT", realtimeCallbackUrl },
                { "REALTIME_CONNECTIONS_TABLE", RealtimeConnectionsTable.TableName }
            };

            var mcpFunction = new LambdaFunction(this, "McpFunction", new LambdaFunctionProps
            {
                FunctionName = $"{config.Prefix}-{config.Name}-mcp",
                Runtime = Runtime.NODEJS_24_X,
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

            // =============================================================================
            // API Gateway routes. API Gateway picks the most specific explicit resource and
            // does not fall back to a shallower {proxy+}, so the parents of every explicit
            // path also get router methods. Parsed by backend/src/router/__tests__/cdk-parity.test.ts:
            // keep one call per line with literal strings, and add methods only via these helpers.
            // =============================================================================
            var cognitoAuthorizer = new CognitoUserPoolsAuthorizer(this, "PagesAuthorizer", new CognitoUserPoolsAuthorizerProps
            {
                CognitoUserPools = new[] { UserPool }
            });
            var routerIntegration = new LambdaIntegration(apiRouterFunction, new LambdaIntegrationOptions { AllowTestInvoke = false });

            Amazon.CDK.AWS.APIGateway.IResource ApiPath(string path)
            {
                Amazon.CDK.AWS.APIGateway.IResource current = Api.Root;
                foreach (var part in path.Split('/', System.StringSplitOptions.RemoveEmptyEntries))
                {
                    current = current.GetResource(part) ?? current.AddResource(part);
                }
                return current;
            }

            void RouteToRouter(string path) =>
                ApiPath(path).AddMethod("ANY", routerIntegration, new MethodOptions
                {
                    AuthorizationType = AuthorizationType.COGNITO,
                    Authorizer = cognitoAuthorizer
                });

            void RouteToFunction(string method, string path, Amazon.CDK.AWS.Lambda.IFunction function) =>
                ApiPath(path).AddMethod(method, new LambdaIntegration(function), new MethodOptions
                {
                    AuthorizationType = AuthorizationType.COGNITO,
                    Authorizer = cognitoAuthorizer
                });

            void RoutePublic(string method, string path, Amazon.CDK.AWS.Lambda.IFunction function) =>
                ApiPath(path).AddMethod(method, new LambdaIntegration(function));

            void RouteWithApiKey(string method, string path, Amazon.CDK.AWS.Lambda.IFunction function) =>
                ApiPath(path).AddMethod(method, new LambdaIntegration(function), new MethodOptions
                {
                    ApiKeyRequired = true
                });

            RouteToRouter("{proxy+}");
            RouteToRouter("pages");
            RouteToRouter("pages/{guid}");
            RouteToRouter("pages/{guid}/{proxy+}");
            RouteToRouter("admin/{proxy+}");
            RouteToRouter("auth/{proxy+}");
            RoutePublic("POST", "auth/register", apiRouterFunction);
            RouteToFunction("POST", "pages/{guid}/ticket-keys/backfill", ticketKeysBackfillFunction);
            RouteToFunction("POST", "pages/{guid}/board-order/backfill", boardOrderBackfillFunction);
            RouteToFunction("POST", "admin/rebuild-page-index", adminRebuildPageIndexFunction);
            RouteToFunction("POST", "fetch-url", proxyFetchUrlFunction);
            RouteWithApiKey("POST", "mcp", mcpFunction);
            RouteWithApiKey("GET", "mcp", mcpFunction);

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
                Runtime = Runtime.NODEJS_24_X,
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
            
            new CfnOutput(this, "JwtParameterName", new CfnOutputProps
            {
                Value = JwtParameterName,
                Description = "JWT signing secret path in SSM Parameter Store",
                ExportName = $"{config.Name}-jwt-parameter-name"
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

        private static UserPoolEmail BuildUserPoolEmail(EnvironmentConfig config)
        {
            if (string.IsNullOrWhiteSpace(config.SesFromAddress))
                return UserPoolEmail.WithCognito();

            var atIndex = config.SesFromAddress.IndexOf('@');
            if (atIndex < 0 || atIndex == config.SesFromAddress.Length - 1)
                throw new System.ArgumentException($"sesFromAddress '{config.SesFromAddress}' is not a valid email address.");

            var verifiedDomain = config.SesFromAddress.Substring(atIndex + 1);

            return UserPoolEmail.WithSES(new UserPoolSESOptions
            {
                FromEmail = config.SesFromAddress,
                FromName = string.IsNullOrWhiteSpace(config.SesFromName) ? null : config.SesFromName,
                SesVerifiedDomain = verifiedDomain
            });
        }
    }
}
