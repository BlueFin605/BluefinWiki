import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../config/api';

interface RebuildResult {
  totalPages: number;
  indexed: number;
  failed: number;
  errors: string[];
  durationMs: number;
  deletedOrphans: number;
  orphanGuids: string[];
}

export const RebuildPageIndex: React.FC = () => {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RebuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRebuild = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setConfirming(false);
    try {
      const response = await apiClient.post<RebuildResult>('/admin/rebuild-page-index');
      setResult(response.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setError(
        e.response?.data?.error ||
        e.response?.data?.message ||
        e.message ||
        'Failed to rebuild page index'
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Back to settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Rebuild Page Index</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              The page index is a DynamoDB table that maps each page GUID to its S3 location.
              Rebuilding it walks every page in S3, refreshes the corresponding rows, and deletes
              any rows whose GUID no longer exists in S3.
            </p>
            <p>
              Use this when pages have been deleted or modified directly in S3 and the index has
              gone stale, or after recovering corrupted page content. Reads against the wiki may
              be slower while the rebuild is running.
            </p>
          </div>

          {!confirming && !running && !result && !error && (
            <button
              onClick={() => setConfirming(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
            >
              Rebuild now
            </button>
          )}

          {confirming && (
            <div className="border border-purple-200 bg-purple-50 rounded-md p-4">
              <p className="text-sm text-gray-800 mb-3">
                This will scan the entire pages bucket and overwrite every row in the page index
                table, then delete any orphan rows. It may take several minutes on large wikis.
                Continue?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={startRebuild}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
                >
                  Yes, rebuild
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {running && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Rebuild in progress — please don't close this page.
            </div>
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 text-red-800 rounded-md p-3 text-sm">
              {error}
              <div className="mt-2">
                <button
                  onClick={() => { setError(null); }}
                  className="underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="border border-green-200 bg-green-50 rounded-md p-4 space-y-3 text-sm">
              <div className="font-medium text-green-900">Rebuild complete</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-800">
                <dt className="text-gray-500">Pages discovered</dt>
                <dd>{result.totalPages}</dd>
                <dt className="text-gray-500">Rows written</dt>
                <dd>{result.indexed}</dd>
                <dt className="text-gray-500">Orphan rows deleted</dt>
                <dd>{result.deletedOrphans}</dd>
                <dt className="text-gray-500">Failed</dt>
                <dd>{result.failed}</dd>
                <dt className="text-gray-500">Duration</dt>
                <dd>{(result.durationMs / 1000).toFixed(1)}s</dd>
              </dl>
              {result.errors.length > 0 && (
                <details className="text-xs text-gray-700">
                  <summary className="cursor-pointer text-red-700">
                    {result.errors.length} error(s) — show
                  </summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              {result.orphanGuids.length > 0 && (
                <details className="text-xs text-gray-700">
                  <summary className="cursor-pointer">
                    Deleted orphan GUIDs ({result.orphanGuids.length}) — show
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono">
                    {result.orphanGuids.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                onClick={() => { setResult(null); }}
                className="text-purple-700 underline"
              >
                Run again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RebuildPageIndex;
