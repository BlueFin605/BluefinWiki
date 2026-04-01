import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../config/api';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  // Display name editing
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setNameLoading(true);
    setNameError(null);
    setNameSuccess(false);
    try {
      await apiClient.put('/auth/profile', { displayName: displayName.trim() });
      setNameSuccess(true);
      // Refresh auth context to pick up the new displayName
      try { await refreshUser(); } catch { /* best effort */ }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setNameError(error.response?.data?.error || 'Failed to update display name');
    } finally {
      setNameLoading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setPwError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const roleBadge = (role: string) => {
    const color = role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/pages')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        </div>

        {/* Profile Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
              {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{user?.displayName || 'No name set'}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="mt-1">{roleBadge(user?.role || 'Standard')}</div>
            </div>
          </div>

          {/* Display Name Form */}
          <form onSubmit={saveName}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            {nameError && <div className="mb-2 text-sm text-red-600">{nameError}</div>}
            {nameSuccess && <div className="mb-2 text-sm text-green-600">Display name updated!</div>}
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setNameSuccess(false); }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your display name"
              />
              <button
                type="submit"
                disabled={nameLoading || !displayName.trim() || displayName === user?.displayName}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {nameLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
          {pwError && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{pwError}</div>}
          {pwSuccess && <div className="mb-3 p-2 bg-green-50 text-green-700 rounded text-sm">Password changed successfully!</div>}
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPwSuccess(false); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {pwLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
