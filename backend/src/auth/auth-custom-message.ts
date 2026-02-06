/**
 * Cognito Custom Message Trigger
 * 
 * This Lambda function customizes email messages sent by Cognito, including:
 * - Password reset emails
 * - Email verification codes
 * - Welcome emails
 * 
 * Trigger: Cognito User Pool - CustomMessage
 */

import { CustomMessageTriggerHandler } from 'aws-lambda';

const WIKI_NAME = process.env.WIKI_NAME || 'BlueFinWiki';
const WIKI_URL = process.env.WIKI_URL || 'http://localhost:5173';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@bluefinwiki.com';

/**
 * Generate HTML email template for password reset
 */
function generatePasswordResetEmail(
  userName: string,
  email: string,
  code: string
): { subject: string; htmlBody: string; textBody: string } {
  const resetUrl = `${WIKI_URL}/reset-password?code=${code}&email=${encodeURIComponent(email)}`;

  const subject = `Reset Your ${WIKI_NAME} Password`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #fff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .button:hover {
      background: #5568d3;
    }
    .code-box {
      background: #f3f4f6;
      border: 2px dashed #d1d5db;
      padding: 15px;
      margin: 20px 0;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 2px;
      font-family: 'Courier New', monospace;
      color: #1f2937;
      border-radius: 6px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 ${WIKI_NAME}</h1>
    <p>Password Reset Request</p>
  </div>
  
  <div class="content">
    <p>Hello ${userName},</p>
    
    <p>We received a request to reset your password for your ${WIKI_NAME} account (<strong>${email}</strong>).</p>
    
    <p>To reset your password, use the verification code below:</p>
    
    <div class="code-box">
      ${code}
    </div>
    
    <p style="text-align: center;">Or click the button below to reset your password directly:</p>
    
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <div class="warning">
      <strong>⚠️ Security Notice:</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>This verification code will expire in <strong>1 hour</strong></li>
        <li>If you didn't request this reset, please ignore this email</li>
        <li>Never share your verification code with anyone</li>
      </ul>
    </div>
    
    <p>If you have any questions or concerns, please contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    
    <p>Best regards,<br>
    The ${WIKI_NAME} Team</p>
  </div>
  
  <div class="footer">
    <p>This is an automated message from ${WIKI_NAME}. Please do not reply to this email.</p>
    <p>&copy; ${new Date().getFullYear()} ${WIKI_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

  const textBody = `
${WIKI_NAME} - Password Reset Request

Hello ${userName},

We received a request to reset your password for your ${WIKI_NAME} account (${email}).

Your verification code is: ${code}

This code will expire in 1 hour.

To reset your password, visit:
${resetUrl}

If you didn't request this reset, please ignore this email.

For assistance, contact us at ${SUPPORT_EMAIL}.

Best regards,
The ${WIKI_NAME} Team

---
This is an automated message. Please do not reply to this email.
`;

  return { subject, htmlBody, textBody };
}

/**
 * Generate HTML email template for email verification
 */
function generateVerificationEmail(
  userName: string,
  email: string,
  code: string
): { subject: string; htmlBody: string; textBody: string } {
  const verifyUrl = `${WIKI_URL}/verify-email?code=${code}&email=${encodeURIComponent(email)}`;

  const subject = `Verify Your ${WIKI_NAME} Email`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .content {
      background: #fff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .code-box {
      background: #f3f4f6;
      border: 2px dashed #d1d5db;
      padding: 15px;
      margin: 20px 0;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 2px;
      font-family: 'Courier New', monospace;
      color: #1f2937;
      border-radius: 6px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✉️ ${WIKI_NAME}</h1>
    <p>Email Verification</p>
  </div>
  
  <div class="content">
    <p>Hello ${userName},</p>
    
    <p>Welcome to ${WIKI_NAME}! To complete your registration, please verify your email address.</p>
    
    <p>Your verification code is:</p>
    
    <div class="code-box">
      ${code}
    </div>
    
    <p style="text-align: center;">Or click the button below:</p>
    
    <div style="text-align: center;">
      <a href="${verifyUrl}" class="button">Verify Email</a>
    </div>
    
    <p><small>This code will expire in 24 hours.</small></p>
  </div>
  
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} ${WIKI_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

  const textBody = `
${WIKI_NAME} - Email Verification

Hello ${userName},

Welcome to ${WIKI_NAME}! To complete your registration, please verify your email address.

Your verification code is: ${code}

Visit: ${verifyUrl}

This code will expire in 24 hours.

Best regards,
The ${WIKI_NAME} Team
`;

  return { subject, htmlBody, textBody };
}

/**
 * Cognito Custom Message Trigger Handler
 */
export const handler: CustomMessageTriggerHandler = async (event) => {
  console.log('Custom Message Trigger Event:', JSON.stringify(event, null, 2));

  try {
    const userName = event.request.userAttributes.name || event.request.userAttributes.email.split('@')[0];
    const email = event.request.userAttributes.email;
    const code = event.request.codeParameter;

    // Determine the message type
    switch (event.triggerSource) {
      case 'CustomMessage_ForgotPassword':
        const resetEmail = generatePasswordResetEmail(userName, email, code);
        event.response.emailSubject = resetEmail.subject;
        event.response.emailMessage = resetEmail.htmlBody;
        event.response.smsMessage = `Your ${WIKI_NAME} password reset code is: ${code}`;
        break;

      case 'CustomMessage_SignUp':
      case 'CustomMessage_ResendCode':
        const verifyEmail = generateVerificationEmail(userName, email, code);
        event.response.emailSubject = verifyEmail.subject;
        event.response.emailMessage = verifyEmail.htmlBody;
        event.response.smsMessage = `Your ${WIKI_NAME} verification code is: ${code}`;
        break;

      case 'CustomMessage_AdminCreateUser':
        event.response.emailSubject = `Welcome to ${WIKI_NAME}`;
        event.response.emailMessage = `
          <h1>Welcome to ${WIKI_NAME}!</h1>
          <p>Hello ${userName},</p>
          <p>Your account has been created. Your temporary password is:</p>
          <p><strong>${code}</strong></p>
          <p>You will be required to change this password on your first login.</p>
          <p>Visit: ${WIKI_URL}</p>
        `;
        break;

      case 'CustomMessage_UpdateUserAttribute':
      case 'CustomMessage_VerifyUserAttribute':
        event.response.emailSubject = `Verify Your ${WIKI_NAME} Email Update`;
        event.response.emailMessage = `
          <h1>Email Update Verification</h1>
          <p>Your verification code is: <strong>${code}</strong></p>
        `;
        break;

      default:
        console.log(`Unhandled trigger source: ${event.triggerSource}`);
    }

    console.log('Custom message generated successfully');
    return event;
  } catch (error) {
    console.error('Error in custom message trigger:', error);
    throw error;
  }
};
