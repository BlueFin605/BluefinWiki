import { PreSignUpTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminLinkProviderForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

/**
 * Cognito Pre Sign-Up Trigger
 *
 * Handles federated (external provider) sign-in:
 * 1. Looks up whether a native Cognito user with the same email already exists.
 * 2. If found — links the external identity to the existing user so they share
 *    a single profile, then auto-confirms & auto-verifies the email.
 * 3. If not found — rejects the sign-up (invite-only system).
 *
 * For native (username+password) sign-ups this trigger is a no-op because
 * registration is handled by the /auth/register endpoint which creates the
 * Cognito user directly.
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  console.log('Pre sign-up trigger:', {
    triggerSource: event.triggerSource,
    userName: event.userName,
    email: event.request.userAttributes.email,
  });

  // Only act on external provider sign-ups
  if (event.triggerSource !== 'PreSignUp_ExternalProvider') {
    return event;
  }

  const email = event.request.userAttributes.email;
  if (!email) {
    throw new Error('No email provided by external identity provider.');
  }

  // Find existing native user with this email
  const existingUser = await findUserByEmail(event.userPoolId, email);

  if (!existingUser) {
    throw new Error(
      `No account found for ${email}. Please register with an invitation first.`
    );
  }

  // Parse provider name and provider user ID from the userName
  // Federated userNames look like "Google_1234567890" or "google_1234567890"
  const [providerName, providerUserId] = parseProviderFromUserName(event.userName);

  if (!providerName || !providerUserId) {
    throw new Error('Unable to determine identity provider from user name.');
  }

  // Link the external identity to the existing native user
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

  // Auto-confirm and auto-verify so the user doesn't get a verification prompt
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  return event;
};

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
