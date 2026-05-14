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

  const cognitoUserId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  if (!cognitoUserId) {
    console.error('Missing Cognito user ID (sub) in user attributes');
    throw new Error('Missing user identifier.');
  }

  // Load user profile from DynamoDB. We fail closed: any error here (transient DB
  // issue or genuinely-missing record) blocks token generation. Combined with a
  // short token lifetime, this is the gate that enforces revocation.
  const userProfile = await getUserProfile(cognitoUserId);

  if (!userProfile) {
    console.warn('No user profile, blocking token generation:', { cognitoUserId, email });
    throw new Error('No account found. Please register with an invitation.');
  }

  if (userProfile.status === 'suspended') {
    console.warn('Suspended user blocked from token generation:', { cognitoUserId, email });
    throw new Error('Account suspended.');
  }

  if (userProfile.status === 'deleted') {
    console.warn('Deleted user blocked from token generation:', { cognitoUserId, email });
    throw new Error('Account not found.');
  }

  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        'custom:role': userProfile.role,
        'custom:displayName': userProfile.displayName,
        'custom:status': userProfile.status,
      },
    },
  };

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
};

/**
 * Get user profile from DynamoDB
 */
async function getUserProfile(cognitoUserId: string): Promise<UserProfileRecord | null> {
  const result = await dynamoClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { cognitoUserId },
  }));

  if (!result.Item) {
    return null;
  }

  return result.Item as UserProfileRecord;
}
