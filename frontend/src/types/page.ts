/**
 * Page types for BlueFinWiki frontend
 */

export interface PageContent {
  guid: string;
  title: string;
  content: string; // Markdown content
  folderId: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  description?: string;
  createdBy: string;
  modifiedBy: string;
  createdAt: string;
  modifiedAt: string;
}

export interface PageSummary {
  guid: string;
  title: string;
  parentGuid: string | null;
  status: 'draft' | 'published' | 'archived';
  modifiedAt: string;
  modifiedBy: string;
  hasChildren: boolean;
}

export interface PageTreeNode extends PageSummary {
  children?: PageTreeNode[];
  isExpanded?: boolean;
}

export interface CreatePageRequest {
  title: string;
  parentGuid: string | null;
  description?: string;
  content?: string;
}

export interface UpdatePageRequest {
  title?: string;
  description?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
}

export interface MovePageRequest {
  newParentGuid: string | null;
}

export interface DeletePageRequest {
  recursive?: boolean;
}
