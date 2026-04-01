/**
 * Page types for BlueFinWiki frontend
 */

export type PropertyType = 'string' | 'number' | 'date' | 'tags';

export interface PageTypeProperty {
  name: string;
  type: PropertyType;
  required: boolean;
  defaultValue?: string | number | string[];
}

export interface PageTypeDefinition {
  guid: string;
  name: string;
  icon: string;
  properties: PageTypeProperty[];
  allowedChildTypes: string[];
  allowWikiPageChildren: boolean;
  allowedParentTypes: string[];
  allowAnyParent: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageProperty {
  type: PropertyType;
  value: string | number | string[];
}

export interface PageContent {
  guid: string;
  title: string;
  content: string; // Markdown content
  folderId: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  sortOrder?: number;
  boardOrder?: number;
  description?: string;
  pageType?: string;
  properties?: Record<string, PageProperty>;
  boardConfig?: BoardConfig;
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
  sortOrder?: number;
  boardOrder?: number;
  modifiedAt: string;
  modifiedBy: string;
  hasChildren: boolean;
  pageType?: string;
}

export interface PageTreeNode extends PageSummary {
  children?: PageTreeNode[];
  isExpanded?: boolean;
}

/** Extended child summary with properties, returned by list-children?include=properties */
export interface PageChildDetail extends PageSummary {
  pageType?: string;
  properties?: Record<string, PageProperty>;
  parentTitle?: string; // Populated for deep board fetches — title of the immediate parent
}

/** Board view configuration — stored as first-class frontmatter field on parent page */
export interface BoardConfig {
  columns?: string[];
  colors?: Record<string, string>;
  targetTypeGuid?: string;  // Page type to collect from descendants (deep board)
  depth?: number;            // Max levels to recurse (default 1 = direct children; cap at 10)
  showParentTitle?: boolean; // Show parent page title as card subtitle (default true when targetTypeGuid set)
  swapTitles?: boolean;      // Show parent title as primary, page title as subtitle
  defaultView?: 'content' | 'board'; // Which view to show when opening the page
}

export interface CreatePageRequest {
  title: string;
  parentGuid: string | null;
  description?: string;
  content?: string;
  pageType?: string;
  properties?: Record<string, PageProperty>;
}

export interface UpdatePageRequest {
  title?: string;
  description?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
  pageType?: string | null;
  properties?: Record<string, PageProperty>;
  boardConfig?: BoardConfig | null;
  boardOrder?: number;
}

export interface MovePageRequest {
  newParentGuid: string | null;
}

export interface ReorderRequest {
  parentGuid: string | null;
  orderedGuids: string[];
}

export interface DeletePageRequest {
  recursive?: boolean;
}
