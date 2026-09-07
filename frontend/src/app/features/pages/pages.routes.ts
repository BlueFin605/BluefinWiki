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
        data: { editMode: true },
        loadComponent: () => import('./page-detail').then((m) => m.PageDetail),
      },
      {
        path: ':guid',
        loadComponent: () => import('./page-detail').then((m) => m.PageDetail),
      },
    ],
  },
];
