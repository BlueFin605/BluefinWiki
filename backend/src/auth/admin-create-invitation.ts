import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Environment variables
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE || 'bluefinwiki-invitations-local';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@bluefinwiki.local';

// Initialize AWS clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
const sesClient = new SESClient({ region: AWS_REGION });

// Request validation schema
const CreateInvitationRequestSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['Admin', 'Standard']).default('Standard'),
  expiryDays: z.number().int().min(1).max(30).default(7),
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

/**
 * Generate a unique 8-character alphanumeric invitation code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Check if an invitation code already exists
 */
async function inviteCodeExists(code: string): Promise<boolean> {
  const result = await dynamoClient.send(new GetCommand({
    TableName: INVITATIONS_TABLE,
    Key: { inviteCode: code },
  }));
  return !!result.Item;
}

/**
 * Generate a unique invitation code (retry if collision)
 */
async function generateUniqueInviteCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateInviteCode();
    const exists = await inviteCodeExists(code);
    if (!exists) {
      return code;
    }
    attempts++;
  }
  
  throw new Error('Failed to generate unique invite code after multiple attempts');
}

/**
 * Send invitation email with registration link
 */
async function sendInvitationEmail(
  recipientEmail: string,
  inviteCode: string,
  role: string,
  senderName: string
): Promise<void> {
  const registrationLink = `${FRONTEND_URL}/register?invite=${inviteCode}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .code { background-color: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐟 BlueFinWiki Invitation</h1>
    </div>
    <div class="content">
      <p>Hello!</p>
      <p><strong>${senderName}</strong> has invited you to join <strong>BlueFinWiki</strong> as a <strong>${role}</strong> user.</p>
      <p>BlueFinWiki is a family wiki platform where you can create, organize, and share knowledge with your family members.</p>
      
      <p>Click the button below to create your account:</p>
      <p style="text-align: center;">
        <a href="${registrationLink}" class="button">Create Account</a>
      </p>
      
      <p>Or use this invitation code during registration:</p>
      <div class="code">${inviteCode}</div>
      
      <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
      
      <p>If you did not expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>BlueFinWiki - Your Family Knowledge Base</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const textBody = `
You've been invited to join BlueFinWiki!

${senderName} has invited you to join BlueFinWiki as a ${role} user.

Registration link: ${registrationLink}

Or use this invitation code during registration: ${inviteCode}

This invitation will expire in 7 days.

If you did not expect this invitation, you can safely ignore this email.

---
BlueFinWiki - Your Family Knowledge Base
  `;
  
  try {
    await sesClient.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: {
          Data: '🐟 You\'re invited to join BlueFinWiki',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    }));
    console.log(`Invitation email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    // Don't throw - we still want to create the invitation even if email fails
  }
}

/**
 * Extract user information from JWT token in Authorization header
 */
function extractUserFromToken(event: APIGatewayProxyEvent): { userId: string; email: string; name: string; role: string } {
  const authorizer = event.requestContext?.authorizer;
  
  if (!authorizer) {
    throw new Error('No authorizer context found');
  }
  
  // API Gateway Lambda Authorizer puts claims in requestContext.authorizer
  const userId = authorizer.claims?.sub || authorizer.sub;
  const email = authorizer.claims?.email || authorizer.email;
  const name = authorizer.claims?.name || authorizer.name || email;
  const role = authorizer.claims?.['custom:role'] || authorizer['custom:role'] || 'Standard';
  
  if (!userId || !email) {
    throw new Error('Invalid token: missing required claims');
  }
  
  return { userId, email, name, role };
}

/**
 * Lambda handler for creating invitation codes
 * 
 * This function:
 * 1. Validates admin permissions
 * 2. Generates a unique 8-character invitation code
 * 3. Stores the invitation in DynamoDB
 * 4. Sends an invitation email (if email provided)
 * 
 * Admin-only endpoint
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create invitation request received');
  
  try {
    // Extract user from JWT token
    const user = extractUserFromToken(event);
    
    // Check admin permissions
    if (user.role !== 'Admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Admin access required' }),
      };
    }
    
    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }
    
    const body = JSON.parse(event.body);
    const validatedData = CreateInvitationRequestSchema.parse(body);
    
    // Generate unique invite code
    const inviteCode = await generateUniqueInviteCode();
    
    // Calculate expiry timestamp (Unix timestamp for DynamoDB TTL)
    const now = new Date();
    const expiryDate = new Date(now.getTime() + validatedData.expiryDays * 24 * 60 * 60 * 1000);
    const expiresAt = Math.floor(expiryDate.getTime() / 1000); // Unix timestamp in seconds
    
    // Create invitation record
    const invitation: InvitationRecord = {
      inviteCode,
      email: validatedData.email,
      role: validatedData.role,
      createdBy: user.userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toString(), // Store as string for TTL attribute
      status: 'pending',
    };
    
    // Store in DynamoDB
    await dynamoClient.send(new PutCommand({
      TableName: INVITATIONS_TABLE,
      Item: invitation,
      ConditionExpression: 'attribute_not_exists(inviteCode)', // Ensure uniqueness
    }));
    
    console.log(`Invitation created: ${inviteCode} for role ${validatedData.role}`);
    
    // Send invitation email if email provided
    if (validatedData.email) {
      await sendInvitationEmail(
        validatedData.email,
        inviteCode,
        validatedData.role,
        user.name
      );
    }
    
    // Return success response
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode,
        email: validatedData.email,
        role: validatedData.role,
        expiresAt: expiryDate.toISOString(),
        registrationLink: `${FRONTEND_URL}/register?invite=${inviteCode}`,
      }),
    };
  } catch (err: unknown) {
    console.error('Error creating invitation:', err);
    const error = err as { name?: string; errors?: unknown[]; message?: string };
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation error',
          details: error.errors,
        }),
      };
    }
    
    // Handle DynamoDB errors
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invitation code already exists (collision)' }),
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};
