import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 md:p-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/pages')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Back to pages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/admin/users')}
            className="w-full flex items-center gap-4 bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 text-green-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Members</h3>
              <p className="text-sm text-gray-500">Manage users, roles, and account status</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/admin/invitations')}
            className="w-full flex items-center gap-4 bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 text-yellow-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Invitations</h3>
              <p className="text-sm text-gray-500">Create and manage invitation codes for new members</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/admin/page-types')}
            className="w-full flex items-center gap-4 bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Page Types</h3>
              <p className="text-sm text-gray-500">Define structured page schemas with properties and hierarchy rules</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
