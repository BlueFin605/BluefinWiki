import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../config/api';

interface Invitation {
  inviteCode: string;
  email?: string;
  role: string;
  createdBy: { userId: string; displayName?: string; email?: string };
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'used' | 'revoked' | 'expired';
  usedBy?: { userId: string; displayName?: string; email?: string };
  usedAt?: string;
}

export const InvitationManagement: React.FC = () => {
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<'Admin' | 'Standard'>('Standard');
  const [createExpiry, setCreateExpiry] = useState(7);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await apiClient.get('/admin/invitations', { params });
      setInvitations(response.data.invitations);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      setError('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const createInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        role: createRole,
        expiryDays: createExpiry,
      };
      if (createEmail.trim()) {
        payload.email = createEmail.trim();
      }
      const response = await apiClient.post('/admin/invitations', payload);
      setCreateSuccess(`Invitation created: ${response.data.inviteCode}`);
      setCreateEmail('');
      setCreateRole('Standard');
      setCreateExpiry(7);
      fetchInvitations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setCreateError(error.response?.data?.error || 'Failed to create invitation');
    } finally {
      setCreateLoading(false);
    }
  };

  const revokeInvitation = async (code: string) => {
    setRevoking(code);
    try {
      await apiClient.delete(`/admin/invitations/${code}`);
      fetchInvitations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to revoke invitation');
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      used: 'bg-green-100 text-green-800',
      revoked: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 md:p-8">
        {/* Header */}
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
          <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
        </div>

        {/* Create Invitation */}
        <div className="mb-6">
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Create Invitation
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">New Invitation</h3>
              {createError && (
                <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-sm text-sm">{createError}</div>
              )}
              {createSuccess && (
                <div className="mb-3 p-2 bg-green-50 text-green-700 rounded-sm text-sm">{createSuccess}</div>
              )}
              <form onSubmit={createInvitation} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select
                    value={createRole}
                    onChange={e => setCreateRole(e.target.value as 'Admin' | 'Standard')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expires (days)</label>
                  <input
                    type="number"
                    value={createExpiry}
                    onChange={e => setCreateExpiry(parseInt(e.target.value) || 7)}
                    min={1}
                    max={30}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createLoading ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setCreateError(null); setCreateSuccess(null); }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="mb-4 flex gap-2">
          {['all', 'pending', 'used', 'expired', 'revoked'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 text-xs rounded-full font-medium ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
            <button onClick={fetchInvitations} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading invitations...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No invitations found
                    </td>
                  </tr>
                ) : (
                  invitations.map(inv => (
                    <tr key={inv.inviteCode}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">{inv.inviteCode}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{inv.email || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{statusBadge(inv.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(inv.createdAt)}
                        {inv.createdBy.displayName && (
                          <span className="block text-xs text-gray-400">by {inv.createdBy.displayName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.expiresAt)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => revokeInvitation(inv.inviteCode)}
                            disabled={revoking === inv.inviteCode}
                            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-sm"
                          >
                            {revoking === inv.inviteCode ? '...' : 'Revoke'}
                          </button>
                        )}
                        {inv.status === 'used' && inv.usedBy?.displayName && (
                          <span className="text-xs text-gray-400">Used by {inv.usedBy.displayName}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationManagement;
