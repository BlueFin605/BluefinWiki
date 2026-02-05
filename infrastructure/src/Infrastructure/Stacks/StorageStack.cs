using Amazon.CDK;
using Amazon.CDK.AWS.S3;
using Constructs;
using System.Collections.Generic;

namespace Infrastructure.Stacks
{
    /// <summary>
    /// Storage Stack - S3 buckets for pages, attachments, and exports
    /// </summary>
    public class StorageStack : Stack
    {
        public IBucket PagesBucket { get; private set; }
        public IBucket AttachmentsBucket { get; private set; }
        public IBucket ExportsBucket { get; private set; }
        
        internal StorageStack(Construct scope, string id, IStackProps props, EnvironmentConfig config) 
            : base(scope, id, props)
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
            
            // S3 Bucket for attachments (images, PDFs, etc.)
            AttachmentsBucket = new Bucket(this, "AttachmentsBucket", new BucketProps
            {
                BucketName = $"bluefinwiki-attachments-{config.Name}",
                Versioned = false, // Attachments don't need versioning
                Encryption = BucketEncryption.S3_MANAGED,
                BlockPublicAccess = BlockPublicAccess.BLOCK_ALL,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
                AutoDeleteObjects = !config.IsProd,
                LifecycleRules = new[]
                {
                    new LifecycleRule
                    {
                        Id = "DeleteOrphanedAttachments",
                        Expiration = Duration.Days(90),
                        Enabled = true,
                        Prefix = "orphaned/" // Attachments moved here when page deleted
                    }
                },
                Cors = new[]
                {
                    new CorsRule
                    {
                        AllowedMethods = new[] { HttpMethods.GET, HttpMethods.PUT },
                        AllowedOrigins = new[] { "*" },
                        AllowedHeaders = new[] { "*" },
                        MaxAge = 3000
                    }
                }
            });
            
            // S3 Bucket for exports (PDFs, HTML bundles)
            ExportsBucket = new Bucket(this, "ExportsBucket", new BucketProps
            {
                BucketName = $"bluefinwiki-exports-{config.Name}",
                Versioned = false,
                Encryption = BucketEncryption.S3_MANAGED,
                BlockPublicAccess = BlockPublicAccess.BLOCK_ALL,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
                AutoDeleteObjects = !config.IsProd,
                LifecycleRules = new[]
                {
                    new LifecycleRule
                    {
                        Id = "DeleteOldExports",
                        Expiration = Duration.Days(7), // Auto-cleanup after 7 days
                        Enabled = true
                    }
                }
            });
            
            // Note: FrontendBucket is created in CDN stack to avoid circular dependency
            
            // Stack outputs
            new CfnOutput(this, "PagesBucketName", new CfnOutputProps
            {
                Value = PagesBucket.BucketName,
                Description = "S3 bucket for page storage",
                ExportName = $"{config.Name}-pages-bucket"
            });
            
            new CfnOutput(this, "AttachmentsBucketName", new CfnOutputProps
            {
                Value = AttachmentsBucket.BucketName,
                Description = "S3 bucket for attachments",
                ExportName = $"{config.Name}-attachments-bucket"
            });
            
            new CfnOutput(this, "ExportsBucketName", new CfnOutputProps
            {
                Value = ExportsBucket.BucketName,
                Description = "S3 bucket for exports",
                ExportName = $"{config.Name}-exports-bucket"
            });
        }
    }
}
