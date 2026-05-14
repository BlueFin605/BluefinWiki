import { PreSignUpTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminLinkProviderForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE || 'bluefinwiki-invitations-local';
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

/**
 * Cognito Pre Sign-Up Trigger
 *
 * Handles federated (external provider) sign-in. Three cases:
 *
 * 1. A native Cognito user already exists for the email → link the federated
 *    identity to it so they share one profile.
 * 2. No native user, but a pending invitation matches the email → allow the
 *    federated signup as the registration step. The profile is created in
 *    post-confirmation when the assigned `sub` is available.
 * 3. Neither → reject (invite-only).
 *
 * For native (username+password) sign-ups this trigger is a no-op because
 * registration is handled by the /auth/register endpoint.
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  console.log('Pre sign-up trigger:', {
    triggerSource: event.triggerSource,
    userName: event.userName,
    email: event.request.userAttributes.email,
  });

  if (event.triggerSource !== 'PreSignUp_ExternalProvider') {
    return event;
  }

  const email = event.request.userAttributes.email;
  if (!email) {
    throw new Error('No email provided by external identity provider.');
  }

  const existingUser = await findUserByEmail(event.userPoolId, email);

  if (existingUser) {
    // Case 1: link federated identity to existing native user
    const [providerName, providerUserId] = parseProviderFromUserName(event.userName);

    if (!providerName || !providerUserId) {
      throw new Error('Unable to determine identity provider from user name.');
    }

    await cognitoClient.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: event.userPoolId,
        DestinationUser: {
          ProviderName: 'Cognito',
          ProviderAttributeValue: existingUser.username,
        },
        SourceUser: {
          ProviderName: providerName,
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: providerUserId,
        },
      })
    );

    console.log('Linked external provider to existing user:', {
      email,
      provider: providerName,
      nativeUsername: existingUser.username,
    });

    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    return event;
  }

  // Case 2: no native user — check for a pending invitation
  const invitation = await findPendingInvitationByEmail(email);
  if (!invitation) {
    throw new Error(
      `No account found for ${email}. Please register with an invitation first.`
    );
  }

  console.log('Pending invitation found for federated signup:', {
    email,
    inviteCode: invitation.inviteCode,
    role: invitation.role,
  });

  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};

interface InvitationRecord {
  inviteCode: string;
  email?: string;
  role: 'Admin' | 'Standard';
  status: 'pending' | 'used' | 'revoked';
  expiresAt: string;
}

/**
 * Scan invitations for a pending row matching this email and not yet expired.
 * Email is a non-key attribute so this is a filtered scan; the table is small
 * (TTL prunes expired rows) so a scan is fine.
 */
async function findPendingInvitationByEmail(email: string): Promise<InvitationRecord | null> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const result = await dynamoClient.send(new ScanCommand({
    TableName: INVITATIONS_TABLE,
    FilterExpression: '#email = :email AND #status = :pending',
    ExpressionAttributeNames: { '#email': 'email', '#status': 'status' },
    ExpressionAttributeValues: { ':email': email, ':pending': 'pending' },
  }));

  const matches = (result.Items as InvitationRecord[] | undefined) ?? [];
  const valid = matches.find((inv) => parseInt(inv.expiresAt, 10) > nowSeconds);
  return valid ?? null;
}

/**
 * Find an existing Cognito user by email.
 * Returns the native (Cognito) user, not federated shadow users.
 */
async function findUserByEmail(
  userPoolId: string,
  email: string
): Promise<{ username: string } | null> {
  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${email}"`,
      Limit: 10,
    })
  );

  // Find the native Cognito user (not a federated shadow)
  const nativeUser = result.Users?.find(
    (u) => !u.Username?.includes('_') || u.UserStatus === 'CONFIRMED'
  );

  if (!nativeUser?.Username) {
    return null;
  }

  return { username: nativeUser.Username };
}

/**
 * Parse provider name and user ID from federated userName.
 * Cognito formats these as "ProviderName_ProviderUserId".
 */
function parseProviderFromUserName(
  userName: string
): [string | null, string | null] {
  const underscoreIndex = userName.indexOf('_');
  if (underscoreIndex === -1) {
    return [null, null];
  }

  const provider = userName.substring(0, underscoreIndex);
  const userId = userName.substring(underscoreIndex + 1);

  // Map common provider prefixes to Cognito provider names
  const providerMap: Record<string, string> = {
    google: 'Google',
    facebook: 'Facebook',
    loginwithamazon: 'LoginWithAmazon',
    signinwithapple: 'SignInWithApple',
  };

  const mappedProvider = providerMap[provider.toLowerCase()] || provider;
  return [mappedProvider, userId];
}
