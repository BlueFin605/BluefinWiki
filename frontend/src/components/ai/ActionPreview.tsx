import type { AiAction } from '../../services/AiService';
import type { ActionStatus } from './useAi';

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

      <ActionBody action={action} />

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
    case 'none':
      return 'No action';
  }
}

function ActionBody({ action }: { action: AiAction }) {
  switch (action.type) {
    case 'create_page':
      return (
        <div className="space-y-1 text-gray-700">
          <div><span className="text-gray-500">Title:</span> {action.title}</div>
          {action.tags && action.tags.length > 0 && (
            <div><span className="text-gray-500">Tags:</span> {action.tags.join(', ')}</div>
          )}
          {action.parentGuid && (
            <div><span className="text-gray-500">Parent:</span> <code className="text-xs">{shortId(action.parentGuid)}</code></div>
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
          <div><span className="text-gray-500">Page:</span> <code className="text-xs">{shortId(action.pageGuid)}</code></div>
          {action.title !== undefined && (
            <div><span className="text-gray-500">New title:</span> {action.title}</div>
          )}
          {action.tags !== undefined && (
            <div><span className="text-gray-500">New tags:</span> {action.tags.join(', ') || '(none)'}</div>
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
          <span className="text-gray-500">Page:</span> <code className="text-xs">{shortId(action.pageGuid)}</code>
          {action.recursive && <div className="text-red-700 text-xs mt-1">⚠ Will also delete all child pages</div>}
        </div>
      );
    case 'move_page':
      return (
        <div className="space-y-1 text-gray-700">
          <div><span className="text-gray-500">Page:</span> <code className="text-xs">{shortId(action.pageGuid)}</code></div>
          <div>
            <span className="text-gray-500">New parent:</span>{' '}
            {action.newParentGuid === null || action.newParentGuid === undefined
              ? <em>root</em>
              : <code className="text-xs">{shortId(action.newParentGuid)}</code>}
          </div>
        </div>
      );
    case 'fetch_url':
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
  none: 'M5 12h14',
};

function shortId(id?: string | null): string {
  if (!id) return '';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
