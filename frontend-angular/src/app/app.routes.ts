import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pages' },

  {
    path: 'callback',
    loadComponent: () =>
      import('./features/callback/oauth-callback').then((m) => m.OAuthCallback),
  },

  { path: 'pages', loadComponent: () => import('./features/placeholder/pages-placeholder').then((m) => m.PagesPlaceholder) },
  { path: 'pages/:guid', loadComponent: () => import('./features/placeholder/pages-placeholder').then((m) => m.PagesPlaceholder) },
  { path: 'pages/:guid/edit', loadComponent: () => import('./features/placeholder/page-editor-placeholder').then((m) => m.PageEditorPlaceholder) },
  { path: 'profile', loadComponent: () => import('./features/placeholder/profile-placeholder').then((m) => m.ProfilePlaceholder) },

  { path: 'settings', loadComponent: () => import('./features/placeholder/settings-placeholder').then((m) => m.SettingsPlaceholder) },
  { path: 'admin/page-types', loadComponent: () => import('./features/placeholder/page-types-placeholder').then((m) => m.PageTypesPlaceholder) },
  { path: 'admin/users', loadComponent: () => import('./features/placeholder/users-placeholder').then((m) => m.UsersPlaceholder) },
  { path: 'admin/invitations', loadComponent: () => import('./features/placeholder/invitations-placeholder').then((m) => m.InvitationsPlaceholder) },
  { path: 'admin/rebuild-page-index', loadComponent: () => import('./features/placeholder/rebuild-index-placeholder').then((m) => m.RebuildIndexPlaceholder) },

  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
