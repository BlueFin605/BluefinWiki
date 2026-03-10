using Amazon.CDK;
using Amazon.CDK.AWS.Cognito;
using Amazon.CDK.AWS.IAM;
using Constructs;
using System.Collections.Generic;

namespace Infrastructure.Stacks
{
    /// <summary>
    /// Auth Stack - AWS Cognito User Pool and related authentication resources
    /// </summary>
    public class AuthStack : Stack
    {
        public UserPool UserPool { get; private set; }
        public UserPoolClient WebClient { get; private set; }
        public UserPoolClient NativeClient { get; private set; }
        public CfnIdentityPool IdentityPool { get; private set; }
        
        internal AuthStack(Construct scope, string id, IStackProps props, EnvironmentConfig config) 
            : base(scope, id, props)
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
            
            // Add Lambda triggers (placeholder for future triggers)
            // UserPool.AddTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmationFunction);
            // UserPool.AddTrigger(UserPoolOperation.PRE_TOKEN_GENERATION, preTokenGenerationFunction);
            
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
                EnableTokenRevocation = true,
                
                // Use Cognito defaults for readable/writable attributes
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
            
            // Stack outputs
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
            
            new CfnOutput(this, "IdentityPoolId", new CfnOutputProps
            {
                Value = IdentityPool.Ref,
                Description = "Cognito Identity Pool ID",
                ExportName = $"{config.Name}-identity-pool-id"
            });
        }
        
        private string[] GetCallbackUrls(EnvironmentConfig config)
        {
            return config.Name switch
            {
                "dev" => new[] 
                { 
                    "http://localhost:5173",
                    "http://localhost:5173/callback" 
                },
                "staging" => new[] 
                { 
                    "https://staging.bluefinwiki.com",
                    "https://staging.bluefinwiki.com/callback" 
                },
                "production" => new[] 
                { 
                    "https://bluefinwiki.com",
                    "https://bluefinwiki.com/callback" 
                },
                _ => new[] { "http://localhost:5173" }
            };
        }
        
        private string[] GetLogoutUrls(EnvironmentConfig config)
        {
            return config.Name switch
            {
                "dev" => new[] { "http://localhost:5173" },
                "staging" => new[] { "https://staging.bluefinwiki.com" },
                "production" => new[] { "https://bluefinwiki.com" },
                _ => new[] { "http://localhost:5173" }
            };
        }
    }
}
