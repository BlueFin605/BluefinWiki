import { PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Environment variables
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize AWS clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

interface UserProfileRecord {
  cognitoUserId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  preferences?: {
    theme?: 'light' | 'dark';
    emailNotifications?: boolean;
  };
}

/**
 * Cognito Pre-Token Generation Trigger
 * 
 * This Lambda is triggered before Cognito generates JWT tokens (access and ID tokens).
 * 
 * Actions:
 * 1. Load user profile from DynamoDB
 * 2. Add custom claims to JWT token:
 *    - custom:role (Admin | Standard)
 *    - custom:displayName
 *    - custom:preferences (optional)
 * 
 * These claims are then available in the JWT and can be used for:
 * - Authorization checks in API Gateway or Lambda
 * - Personalization in the frontend
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  console.log('Pre-token generation trigger received:', {
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource,
  });

  try {
    const cognitoUserId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;

    if (!cognitoUserId) {
      console.error('Missing Cognito user ID (sub) in user attributes');
      // Return event without custom claims if sub is missing
      return event;
    }

    // Load user profile from DynamoDB
    const userProfile = await getUserProfile(cognitoUserId);

    if (!userProfile) {
      console.warn('User profile not found for cognitoUserId:', cognitoUserId);
      // Return event with minimal claims if profile doesn't exist yet
      // This can happen during initial registration before profile is created
      return event;
    }

    // Check if user is suspended
    if (userProfile.status === 'suspended') {
      console.warn('Suspended user attempted to login:', { cognitoUserId, email });
      // Don't add claims for suspended users
      // Optionally, you could throw an error here to block login
      // throw new Error('User account is suspended');
      return event;
    }

    if (userProfile.status === 'deleted') {
      console.warn('Deleted user attempted to login:', { cognitoUserId, email });
      // Don't add claims for deleted users
      return event;
    }

    // Add custom claims to the token
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: {
          'custom:role': userProfile.role,
          'custom:displayName': userProfile.displayName,
          'custom:status': userProfile.status,
        },
      },
    };

    // Optionally add preferences if they exist
    if (userProfile.preferences && event.response.claimsOverrideDetails?.claimsToAddOrOverride) {
      event.response.claimsOverrideDetails.claimsToAddOrOverride['custom:preferences'] = 
        JSON.stringify(userProfile.preferences);
    }

    console.log('Custom claims added to token:', {
      cognitoUserId,
      role: userProfile.role,
      displayName: userProfile.displayName,
      status: userProfile.status,
    });

    return event;
  } catch (error) {
    console.error('Error in pre-token generation trigger:', error);
    
    // Don't throw - return event without custom claims rather than blocking authentication
    // This ensures authentication continues even if there's a DynamoDB issue
    return event;
  }
};

/**
 * Get user profile from DynamoDB
 */
async function getUserProfile(cognitoUserId: string): Promise<UserProfileRecord | null> {
  try {
    const getCommand = new GetCommand({
      TableName: USER_PROFILES_TABLE,
      Key: { cognitoUserId },
    });

    const result = await dynamoClient.send(getCommand);
    
    if (!result.Item) {
      return null;
    }

    return result.Item as UserProfileRecord;
  } catch (error) {
    console.error('Error fetching user profile from DynamoDB:', error);
    return null;
  }
}
