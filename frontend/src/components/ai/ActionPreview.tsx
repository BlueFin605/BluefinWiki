import type { AiAction } from '../../services/AiService';
import type { ActionStatus } from './useAi';
import { usePageTypes } from '../../hooks/usePageTypes';
import type { PageTypeDefinition } from '../../types/page';
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { apiClient } from '../../config/api';
import type { PageContent } from '../../types/page';
import { Link } from 'react-router-dom';

interface Props {
  action: AiAction;
  status?: ActionStatus;
  error?: string;
  onApply: () => void;
  onDiscard: () => void;
}

export function ActionPreview({ action, status = 'pending', error, onApply, onDiscard }: Props) {
  const destructive = action.type === 'delete_page';
  const isFinal = status === 'applied' || status === 'discarded';
  const isBusy = status === 'applying';
  const { data: pageTypesList = [] } = usePageTypes();
  const pageTypesMap = Object.fromEntries(pageTypesList.map((pt) => [pt.guid, pt]));
  const referencedPageGuids = useMemo(() => collectReferencedPageGuids(action), [action]);

  const pageNameQueries = useQueries({
    queries: referencedPageGuids.map((guid) => ({
      queryKey: ['pages', 'detail', guid],
      queryFn: async (): Promise<PageContent> => {
        const response = await apiClient.get<PageContent>(`/pages/${guid}`);
        return response.data;
      },
      staleTime: 300_000,
      retry: false,
      enabled: !!guid,
    })),
  });

  const pageNamesByGuid = useMemo(() => {
    return referencedPageGuids.reduce<Record<string, string>>((acc, guid, index) => {
      const title = pageNameQueries[index]?.data?.title;
      if (title) acc[guid] = title;
      return acc;
    }, {});
  }, [referencedPageGuids, pageNameQueries]);

  return (
    <div
      className={`mt-2 rounded-lg border p-3 text-sm ${
        destructive ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'
      }`}
    >
      <div className="font-medium text-gray-900 mb-1 flex items-center gap-2">
        <ActionIcon type={action.type} />
        <span>{actionLabel(action.type)}</span>
        {destructive && <span className="text-red-700 text-xs">destructive</span>}
      </div>

      <ActionBody action={action} pageTypesMap={pageTypesMap} pageNamesByGuid={pageNamesByGuid} />

      {status === 'applied' && (
        <div className="mt-2 text-xs text-green-700">✓ Applied</div>
      )}
      {status === 'discarded' && (
        <div className="mt-2 text-xs text-gray-500">Discarded</div>
      )}
      {status === 'failed' && (
        <div className="mt-2 text-xs text-red-700">Failed: {error}</div>
      )}

      {!isFinal && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={isBusy}
            className={`px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-50 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isBusy ? 'Applying…' : destructive ? 'Apply (destructive)' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isBusy}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

function actionLabel(type: AiAction['type']): string {
  switch (type) {
    case 'create_page':
      return 'Create page';
    case 'update_page':
      return 'Update page';
    case 'delete_page':
      return 'Delete page';
    case 'move_page':
      return 'Move page';
    case 'fetch_url':
      return 'Fetch URL';
    case 'fetch_imdb_show':
      return 'Fetch IMDb show';
    case 'none':
      return 'No action';
  }
}

function ActionBody({
  action,
  pageTypesMap,
  pageNamesByGuid,
}: {
  action: AiAction;
  pageTypesMap: Record<string, PageTypeDefinition>;
  pageNamesByGuid: Record<string, string>;
}) {
  switch (action.type) {
    case 'create_page':
      return (
        <div className="space-y-1 text-gray-700">
          <div><span className="text-gray-500">Title:</span> {action.title}</div>
          {action.tags && action.tags.length > 0 && (
            <div><span className="text-gray-500">Tags:</span> {action.tags.join(', ')}</div>
          )}
          {action.pageType && (
            <div>
              <span className="text-gray-500">Type:</span>{' '}
              {formatPageType(action.pageType, pageTypesMap)}
            </div>
          )}
          {action.pageProperties && Object.keys(action.pageProperties).length > 0 && (
            <div>
              <span className="text-gray-500">Properties:</span>
              <ul className="ml-2 mt-0.5 text-xs space-y-0.5">
                {Object.entries(action.pageProperties).map(([k, v]) => (
                  <li key={k}><span className="text-gray-500">{k}:</span> {formatAiPropertyValue(v)}</li>
                ))}
              </ul>
            </div>
          )}
          {action.parentGuid && (
            <div><span className="text-gray-500">Parent:</span> {formatPageRef(action.parentGuid, pageNamesByGuid)}</div>
          )}
          {action.content && (
            <pre className="mt-1 whitespace-pre-wrap text-xs bg-white border border-gray-200 rounded p-2 max-h-40 overflow-y-auto">
              {action.content}
            </pre>
          )}
        </div>
      );
    case 'update_page':
      return (
        <div className="space-y-1 text-gray-700">
          <div><span className="text-gray-500">Page:</span> {formatPageRef(action.pageGuid, pageNamesByGuid)}</div>
          {action.title !== undefined && (
            <div><span className="text-gray-500">New title:</span> {action.title}</div>
          )}
          {action.tags !== undefined && (
            <div><span className="text-gray-500">New tags:</span> {action.tags.join(', ') || '(none)'}</div>
          )}
          {action.pageType !== undefined && (
            <div>
              <span className="text-gray-500">Type:</span>{' '}
              {formatPageType(action.pageType, pageTypesMap)}
            </div>
          )}
          {action.pageProperties && Object.keys(action.pageProperties).length > 0 && (
            <div>
              <span className="text-gray-500">Properties:</span>
              <ul className="ml-2 mt-0.5 text-xs space-y-0.5">
                {Object.entries(action.pageProperties).map(([k, v]) => (
                  <li key={k}><span className="text-gray-500">{k}:</span> {formatAiPropertyValue(v)}</li>
                ))}
              </ul>
            </div>
          )}
          {action.content !== undefined && (
            <pre className="mt-1 whitespace-pre-wrap text-xs bg-white border border-gray-200 rounded p-2 max-h-40 overflow-y-auto">
              {action.content}
            </pre>
          )}
        </div>
      );
    case 'delete_page':
      return (
        <div className="text-gray-700">
          <span className="text-gray-500">Page:</span> {formatPageRef(action.pageGuid, pageNamesByGuid)}
          {action.recursive && <div className="text-red-700 text-xs mt-1">⚠ Will also delete all child pages</div>}
        </div>
      );
    case 'move_page':
      return (
        <div className="space-y-1 text-gray-700">
          <div><span className="text-gray-500">Page:</span> {formatPageRef(action.pageGuid, pageNamesByGuid)}</div>
          <div>
            <span className="text-gray-500">New parent:</span>{' '}
            {action.newParentGuid === null || action.newParentGuid === undefined
              ? <em>root</em>
              : formatPageRef(action.newParentGuid, pageNamesByGuid)}
          </div>
        </div>
      );
    case 'fetch_url':
    case 'fetch_imdb_show':
    case 'none':
      return null;
  }
}

function ActionIcon({ type }: { type: AiAction['type'] }) {
  const path = ICONS[type];
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

const ICONS: Record<AiAction['type'], string> = {
  create_page: 'M12 4v16m8-8H4',
  update_page: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  delete_page: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3',
  move_page: 'M17 8l4 4m0 0l-4 4m4-4H3',
  fetch_url: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  fetch_imdb_show: 'M11 17a1 1 0 102 0 1 1 0 00-2 0zm1-14a7 7 0 00-7 7c0 2.8 1.64 5.22 4.02 6.34.28.13.48.4.48.71V18a1 1 0 001 1h4a1 1 0 001-1v-.95c0-.31.2-.58.48-.71A7 7 0 0019 10a7 7 0 00-7-7z',
  none: 'M5 12h14',
};

function shortId(id?: string | null): string {
  if (!id) return '';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function collectReferencedPageGuids(action: AiAction): string[] {
  const guids = new Set<string>();

  if (action.type === 'create_page' && action.parentGuid) {
    guids.add(action.parentGuid);
  }

  if (action.type === 'update_page' || action.type === 'delete_page' || action.type === 'move_page') {
    if (action.pageGuid) guids.add(action.pageGuid);
  }

  if (action.type === 'move_page' && action.newParentGuid) {
    guids.add(action.newParentGuid);
  }

  return Array.from(guids);
}

function formatPageRef(guid: string | undefined, pageNamesByGuid: Record<string, string>) {
  if (!guid) return <code className="text-xs">unknown</code>;
  const title = pageNamesByGuid[guid];
  if (!title) return <code className="text-xs">{shortId(guid)}</code>;
  return (
    <>
      <Link to={`/pages/${guid}`} className="text-blue-700 hover:text-blue-800 hover:underline">
        {title}
      </Link>
      <span className="text-xs text-gray-500"> ({shortId(guid)})</span>
    </>
  );
}

function formatPageType(pageTypeGuid: string, pageTypesMap: Record<string, PageTypeDefinition>) {
  const type = pageTypesMap[pageTypeGuid];
  if (!type) return <code className="text-xs">{shortId(pageTypeGuid)}</code>;
  return (
    <>
      {type.icon} {type.name}
      <span className="text-xs text-gray-500"> ({shortId(pageTypeGuid)})</span>
    </>
  );
}

function formatAiPropertyValue(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const wrapped = (value as { value: unknown }).value;
    return Array.isArray(wrapped) ? wrapped.join(', ') : String(wrapped);
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}
