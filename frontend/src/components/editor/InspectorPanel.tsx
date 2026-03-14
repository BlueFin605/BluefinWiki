/**
 * InspectorPanel Component
 *
 * A tabbed bottom panel (like browser DevTools) that consolidates
 * Properties, Attachments, and Linked Pages into a single togglable pane.
 */

import React, { useState } from 'react';
import PagePropertiesPanel, { PageMetadata } from './PagePropertiesPanel';
import { AttachmentManager } from './AttachmentManager';
import { LinkedPagesPanel } from '../pages/LinkedPagesPanel';
import { Backlink } from '../../hooks/usePages';

type InspectorTab = 'properties' | 'attachments' | 'links';

interface InspectorPanelProps {
  // Properties
  metadata?: PageMetadata;
  onMetadataChange?: (metadata: Partial<PageMetadata>) => void;
  editable?: boolean;
  onTitleChange?: (title: string) => void;
  // Attachments
  pageGuid: string;
  currentUserId?: string;
  currentUserRole?: 'Admin' | 'Standard';
  pageAuthorId?: string;
  onInsertMarkdown?: (markdown: string) => void;
  attachmentRefreshKey?: number;
  // Linked Pages
  backlinks: Backlink[];
  backlinksLoading: boolean;
  onPageClick?: (guid: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  metadata,
  onMetadataChange,
  editable,
  onTitleChange,
  pageGuid,
  currentUserId,
  currentUserRole,
  pageAuthorId,
  onInsertMarkdown,
  attachmentRefreshKey,
  backlinks,
  backlinksLoading,
  onPageClick,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('properties');

  const tabs: { id: InspectorTab; label: string; badge?: number }[] = [
    { id: 'properties', label: 'Properties' },
    { id: 'attachments', label: 'Attachments' },
    { id: 'links', label: 'Links', badge: backlinks.length || undefined },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'properties' && metadata && (
          <PagePropertiesPanel
            metadata={metadata}
            onMetadataChange={onMetadataChange || (() => {})}
            editable={editable}
            onTitleChange={onTitleChange}
          />
        )}

        {activeTab === 'attachments' && pageGuid && (
          <AttachmentManager
            pageGuid={pageGuid}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            pageAuthorId={pageAuthorId}
            onInsertMarkdown={onInsertMarkdown}
            refreshKey={attachmentRefreshKey}
            className="border-0"
          />
        )}

        {activeTab === 'links' && (
          <LinkedPagesPanel
            pageGuid={pageGuid}
            backlinks={backlinks}
            isLoading={backlinksLoading}
            onPageClick={onPageClick || (() => {})}
          />
        )}
      </div>
    </div>
  );
};

export default InspectorPanel;
