using Amazon.CDK;
using Amazon.CDK.AWS.CloudFront;
using Amazon.CDK.AWS.CloudFront.Origins;
using Amazon.CDK.AWS.S3;
using Constructs;
using System.Collections.Generic;

namespace Infrastructure.Stacks
{
    /// <summary>
    /// CDN Stack - CloudFront distribution for frontend and API caching
    /// </summary>
    public class CdnStack : Stack
    {
        public IDistribution Distribution { get; private set; }
        public IBucket FrontendBucket { get; private set; }
        
        internal CdnStack(Construct scope, string id, IStackProps props, EnvironmentConfig config) 
            : base(scope, id, props)
        {
            // S3 Bucket for frontend static hosting (SPA)
            // Created in CDN stack to avoid circular dependency with OAI
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
                MaxTtl = Duration.Seconds(0),
                EnableAcceptEncodingBrotli = true,
                EnableAcceptEncodingGzip = true
            });
            
            // CloudFront distribution
            Distribution = new Distribution(this, "FrontendDistribution", new DistributionProps
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
            
            // Stack outputs
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
    }
}
