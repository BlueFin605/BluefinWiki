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
  [key: string]: string | undefined;
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
  details?: Record<string, string | number | boolean | null>;
  createdAt: string; // ISO 8601
}

export interface PageContent {
  guid: string;
  title: string;
  content: string; // Markdown content
  folderId: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived' | 'deleted';
  description?: string; // Optional page description
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

/**
 * Storage Plugin Types
 * These types define the contract for storage plugins (S3, GitHub, etc.)
 */

export interface Version {
  versionId: string;
  timestamp: string; // ISO 8601
  modifiedBy: string; // Cognito sub
  size: number; // in bytes
}

export interface PageSummary {
  guid: string;
  title: string;
  parentGuid: string | null;
  status: 'draft' | 'published' | 'archived';
  modifiedAt: string; // ISO 8601
  modifiedBy: string; // Cognito sub
  hasChildren: boolean;
}

export interface AttachmentUploadInput {
  originalFilename: string;
  contentType: string;
  data: Buffer;
  uploadedBy: string;
}

export interface AttachmentUploadResult {
  filename: string;
  attachmentKey: string;
  contentType: string;
  size: number;
}

export interface AttachmentMetadata {
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  checksum?: string;
}

export interface StoragePluginConfig {
  type: 's3' | 'github' | 'local';
  [key: string]: string | number | boolean | undefined; // Plugin-specific config
}

export interface StoragePluginError extends Error {
  code: string;
  statusCode?: number;
  details?: Record<string, string | number | boolean | null>;
}
