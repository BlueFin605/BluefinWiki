import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { adminGuard } from './core/auth/admin-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pages' },

  {
    path: 'callback',
    loadComponent: () =>
      import('./features/callback/oauth-callback').then((m) => m.OAuthCallback),
  },

  {
    path: 'pages',
    canActivate: [authGuard],
    loadChildren: () => import('./features/pages/pages.routes').then((m) => m.PAGES_ROUTES),
  },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./features/placeholder/profile-placeholder').then((m) => m.ProfilePlaceholder) },

  { path: 'settings', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/placeholder/settings-placeholder').then((m) => m.SettingsPlaceholder) },
  { path: 'admin/page-types', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/page-types/page-types-admin').then((m) => m.PageTypesAdmin) },
  { path: 'admin/users', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/user-management').then((m) => m.UserManagement) },
  { path: 'admin/invitations', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/invitation-management').then((m) => m.InvitationManagement) },
  { path: 'admin/rebuild-page-index', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/rebuild-page-index').then((m) => m.RebuildPageIndex) },

  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
