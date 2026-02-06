import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, MessageActionType } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

// Environment variables
const USER_POOL_ID = process.env.USER_POOL_ID!;
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE || 'bluefinwiki-invitations-local';
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

// Request validation schema
const RegisterRequestSchema = z.object({
  inviteCode: z.string().length(8, 'Invitation code must be 8 characters'),
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

interface InvitationRecord {
  inviteCode: string;
  email?: string;
  role: 'Admin' | 'Standard';
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'used' | 'revoked';
  usedBy?: string;
  usedAt?: string;
}

interface UserProfileRecord {
  cognitoUserId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lambda handler for user registration with invitation code
 * 
 * This function:
 * 1. Validates the invitation code
 * 2. Creates a Cognito user via AdminCreateUser
 * 3. Sets the user's password
 * 4. Creates a user profile in DynamoDB
 * 5. Marks the invitation code as used
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Registration request received:', { path: event.path, body: event.body ? '***' : null });

  try {
    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = RegisterRequestSchema.parse(body);

    // Step 1: Validate invitation code
    const invitation = await validateInvitationCode(validatedData.inviteCode, validatedData.email);

    // Step 2: Create Cognito user
    const cognitoUserId = await createCognitoUser(
      validatedData.email,
      validatedData.displayName,
      invitation.role,
      validatedData.password
    );

    // Step 3: Create user profile in DynamoDB
    await createUserProfile({
      cognitoUserId,
      email: validatedData.email,
      displayName: validatedData.displayName,
      role: invitation.role,
      inviteCode: validatedData.inviteCode,
    });

    // Step 4: Mark invitation as used
    await markInvitationUsed(validatedData.inviteCode, cognitoUserId);

    // Step 5: Return success response
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'User registered successfully',
        userId: cognitoUserId,
        email: validatedData.email,
        role: invitation.role,
      }),
    };
  } catch (error) {
    console.error('Registration error:', error);

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation error',
          details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
        }),
      };
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('Invitation')) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: error.message }),
        };
      }

      if (error.name === 'UsernameExistsException') {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'A user with this email already exists' }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error during registration' }),
    };
  }
};

/**
 * Validate invitation code and check eligibility
 */
async function validateInvitationCode(inviteCode: string, email: string): Promise<InvitationRecord> {
  const getCommand = new GetCommand({
    TableName: INVITATIONS_TABLE,
    Key: { inviteCode },
  });

  const result = await dynamoClient.send(getCommand);

  if (!result.Item) {
    throw new Error('Invitation code not found');
  }

  const invitation = result.Item as InvitationRecord;

  // Check if invitation has been revoked
  if (invitation.status === 'revoked') {
    throw new Error('Invitation code has been revoked');
  }

  // Check if invitation has already been used
  if (invitation.status === 'used') {
    throw new Error('Invitation code has already been used');
  }

  // Check if invitation is still valid
  if (invitation.status !== 'pending') {
    throw new Error(`Invitation code is not valid (status: ${invitation.status})`);
  }

  // Check expiration (expiresAt is Unix timestamp in seconds)
  const now = Math.floor(Date.now() / 1000);
  const expiresAtTimestamp = parseInt(invitation.expiresAt, 10);
  if (now > expiresAtTimestamp) {
    throw new Error('Invitation code has expired');
  }

  // If email is pre-assigned, verify it matches
  if (invitation.email && invitation.email !== email) {
    throw new Error('This invitation code is for a different email address');
  }

  return invitation;
}

/**
 * Create user in Cognito User Pool
 */
async function createCognitoUser(
  email: string,
  displayName: string,
  role: 'Admin' | 'Standard',
  password: string
): Promise<string> {
  // Create user with AdminCreateUser
  const createUserCommand = new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' }, // Skip email verification for invited users
      { Name: 'name', Value: displayName },
      { Name: 'custom:role', Value: role },
    ],
    MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email (we'll handle it)
    TemporaryPassword: generateTemporaryPassword(),
  });

  const createUserResponse = await cognitoClient.send(createUserCommand);

  if (!createUserResponse.User?.Username) {
    throw new Error('Failed to create Cognito user');
  }

  const cognitoUsername = createUserResponse.User.Username;

  // Set permanent password
  const setPasswordCommand = new AdminSetUserPasswordCommand({
    UserPoolId: USER_POOL_ID,
    Username: cognitoUsername,
    Password: password,
    Permanent: true,
  });

  await cognitoClient.send(setPasswordCommand);

  // Extract Cognito sub (user ID) from attributes
  const subAttribute = createUserResponse.User.Attributes?.find((attr) => attr.Name === 'sub');
  if (!subAttribute?.Value) {
    throw new Error('Failed to retrieve Cognito user ID');
  }

  return subAttribute.Value;
}

/**
 * Create user profile in DynamoDB
 */
async function createUserProfile(data: {
  cognitoUserId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  inviteCode: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const userProfile: UserProfileRecord = {
    cognitoUserId: data.cognitoUserId,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    status: 'pending', // Will be updated to 'active' by post-confirmation trigger
    inviteCode: data.inviteCode,
    createdAt: now,
    updatedAt: now,
  };

  const putCommand = new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: userProfile,
  });

  await dynamoClient.send(putCommand);
  console.log('User profile created:', { cognitoUserId: data.cognitoUserId, email: data.email });
}

/**
 * Mark invitation code as used
 */
async function markInvitationUsed(inviteCode: string, cognitoUserId: string): Promise<void> {
  const now = new Date().toISOString();

  const updateCommand = new UpdateCommand({
    TableName: INVITATIONS_TABLE,
    Key: { inviteCode },
    UpdateExpression: 'SET #status = :status, usedBy = :usedBy, usedAt = :usedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'used',
      ':usedBy': cognitoUserId,
      ':usedAt': now,
    },
  });

  await dynamoClient.send(updateCommand);
  console.log('Invitation marked as used:', { inviteCode, cognitoUserId });
}

/**
 * Generate a temporary password (used for initial user creation)
 */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
