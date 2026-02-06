/**
 * Shared types for authentication and authorization
 */

export interface UserContext {
  userId: string; // Cognito sub
  email: string;
  role: 'Admin' | 'Standard';
  displayName: string;
  status?: string;
  preferences?: {
    theme?: 'light' | 'dark';
    emailNotifications?: boolean;
  };
}

export interface CognitoClaims {
  sub: string;
  email: string;
  'custom:role': string;
  'custom:displayName': string;
  'custom:status'?: string;
  'custom:preferences'?: string;
  [key: string]: any;
}

export interface InvitationRecord {
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

export interface UserProfileRecord {
  cognitoUserId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences?: {
    theme?: 'light' | 'dark';
    emailNotifications?: boolean;
  };
}

export interface ActivityLogRecord {
  userId: string; // Cognito sub
  timestamp: number; // Unix timestamp for sort key
  action: string;
  resourceType: string;
  resourceGuid: string;
  details?: Record<string, any>;
  createdAt: string; // ISO 8601
}

export interface PageContent {
  guid: string;
  title: string;
  content: string; // Markdown content
  folderId: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  createdBy: string; // Cognito sub
  modifiedBy: string; // Cognito sub
  createdAt: string; // ISO 8601
  modifiedAt: string; // ISO 8601
}

export interface FolderData {
  guid: string;
  name: string;
  parentGuid: string | null;
  description?: string;
  color?: string;
  createdBy: string; // Cognito sub
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
