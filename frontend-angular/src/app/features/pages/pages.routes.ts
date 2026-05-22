import type { Routes } from '@angular/router';

export const PAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages-view').then((m) => m.PagesView),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./page-empty').then((m) => m.PageEmpty),
      },
      {
        path: ':guid/edit',
        loadComponent: () => import('./page-edit').then((m) => m.PageEdit),
      },
      {
        path: ':guid',
        loadComponent: () => import('./page-view').then((m) => m.PageView),
      },
    ],
  },
];
