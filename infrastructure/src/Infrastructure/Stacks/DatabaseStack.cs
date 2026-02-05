using Amazon.CDK;
using Amazon.CDK.AWS.DynamoDB;
using Constructs;

namespace Infrastructure.Stacks
{
    /// <summary>
    /// Database Stack - DynamoDB tables for user data, metadata, and search index
    /// </summary>
    public class DatabaseStack : Stack
    {
        public Table UsersTable { get; private set; }
        public Table InvitationsTable { get; private set; }
        public Table PageLinksTable { get; private set; }
        public Table AttachmentsTable { get; private set; }
        public Table CommentsTable { get; private set; }
        public Table ActivityLogTable { get; private set; }
        public Table UserPreferencesTable { get; private set; }
        public Table SiteConfigTable { get; private set; }
        
        internal DatabaseStack(Construct scope, string id, IStackProps props, EnvironmentConfig config) 
            : base(scope, id, props)
        {
            // Users table - authentication and user profiles
            UsersTable = new Table(this, "UsersTable", new TableProps
            {
                TableName = $"bluefinwiki-users-{config.Name}",
                PartitionKey = new Attribute { Name = "userId", Type = AttributeType.STRING },
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
            
            // GSI for email lookups during login
            UsersTable.AddGlobalSecondaryIndex(new GlobalSecondaryIndexProps
            {
                IndexName = "email-index",
                PartitionKey = new Attribute { Name = "email", Type = AttributeType.STRING },
                ProjectionType = ProjectionType.ALL
            });
            
            // Invitations table - invite codes for user registration
            InvitationsTable = new Table(this, "InvitationsTable", new TableProps
            {
                TableName = $"bluefinwiki-invitations-{config.Name}",
                PartitionKey = new Attribute { Name = "inviteCode", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                TimeToLiveAttribute = "expiresAt" // Auto-delete expired invitations
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
            
            // Attachments table - metadata for uploaded files
            AttachmentsTable = new Table(this, "AttachmentsTable", new TableProps
            {
                TableName = $"bluefinwiki-attachments-{config.Name}",
                PartitionKey = new Attribute { Name = "guid", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });
            
            // GSI for querying attachments by page
            AttachmentsTable.AddGlobalSecondaryIndex(new GlobalSecondaryIndexProps
            {
                IndexName = "pageGuid-index",
                PartitionKey = new Attribute { Name = "pageGuid", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "uploadedAt", Type = AttributeType.STRING },
                ProjectionType = ProjectionType.ALL
            });
            
            // Comments table - page discussions
            CommentsTable = new Table(this, "CommentsTable", new TableProps
            {
                TableName = $"bluefinwiki-comments-{config.Name}",
                PartitionKey = new Attribute { Name = "guid", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });
            
            // GSI for querying comments by page
            CommentsTable.AddGlobalSecondaryIndex(new GlobalSecondaryIndexProps
            {
                IndexName = "pageGuid-createdAt-index",
                PartitionKey = new Attribute { Name = "pageGuid", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "createdAt", Type = AttributeType.STRING },
                ProjectionType = ProjectionType.ALL
            });
            
            // Activity Log table - audit trail
            ActivityLogTable = new Table(this, "ActivityLogTable", new TableProps
            {
                TableName = $"bluefinwiki-activity-log-{config.Name}",
                PartitionKey = new Attribute { Name = "userId", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "timestamp", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY,
                TimeToLiveAttribute = "expiresAt" // Auto-delete old logs (90 days)
            });
            
            // User Preferences table - dashboard customization, favorites
            UserPreferencesTable = new Table(this, "UserPreferencesTable", new TableProps
            {
                TableName = $"bluefinwiki-user-preferences-{config.Name}",
                PartitionKey = new Attribute { Name = "userId", Type = AttributeType.STRING },
                SortKey = new Attribute { Name = "preferenceKey", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = RemovalPolicy.DESTROY
            });
            
            // Site Config table - global settings
            SiteConfigTable = new Table(this, "SiteConfigTable", new TableProps
            {
                TableName = $"bluefinwiki-site-config-{config.Name}",
                PartitionKey = new Attribute { Name = "configKey", Type = AttributeType.STRING },
                BillingMode = BillingMode.PAY_PER_REQUEST,
                RemovalPolicy = config.IsProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
            });
            
            // Stack outputs
            new CfnOutput(this, "UsersTableName", new CfnOutputProps
            {
                Value = UsersTable.TableName,
                Description = "DynamoDB table for users",
                ExportName = $"{config.Name}-users-table"
            });
            
            new CfnOutput(this, "PageLinksTableName", new CfnOutputProps
            {
                Value = PageLinksTable.TableName,
                Description = "DynamoDB table for page links",
                ExportName = $"{config.Name}-page-links-table"
            });
        }
    }
}
