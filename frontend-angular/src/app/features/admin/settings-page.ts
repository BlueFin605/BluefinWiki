import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/auth/auth';

interface SettingsTile {
  title: string;
  description: string;
  icon: string;
  link: string;
  adminOnly: boolean;
}

const TILES: SettingsTile[] = [
  {
    title: 'Page Types',
    description: 'Define structured page schemas with properties and hierarchy rules.',
    icon: 'category',
    link: '/admin/page-types',
    adminOnly: true,
  },
  {
    title: 'User Management',
    description: 'Manage members, roles, and account status.',
    icon: 'group',
    link: '/admin/users',
    adminOnly: true,
  },
  {
    title: 'Invitations',
    description: 'Create and manage invitation codes for new members.',
    icon: 'mail',
    link: '/admin/invitations',
    adminOnly: true,
  },
  {
    title: 'Rebuild Page Index',
    description: 'Recover from a stale or corrupt page index by rescanning S3.',
    icon: 'refresh',
    link: '/admin/rebuild-page-index',
    adminOnly: true,
  },
  {
    title: 'Profile',
    description: 'View your profile and sign out.',
    icon: 'person',
    link: '/profile',
    adminOnly: false,
  },
];

@Component({
  selector: 'wiki-settings-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <h1>Settings</h1>
      <div class="grid">
        @for (tile of visibleTiles(); track tile.link) {
          <a [routerLink]="tile.link" class="tile" [attr.aria-label]="tile.title">
            <mat-card>
              <div class="tile-body">
                <mat-icon>{{ tile.icon }}</mat-icon>
                <div class="tile-text">
                  <h2>{{ tile.title }}</h2>
                  <p>{{ tile.description }}</p>
                </div>
              </div>
            </mat-card>
          </a>
        }
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .page { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
      .tile { text-decoration: none; color: inherit; display: block; }
      .tile mat-card { padding: 1rem; transition: background 0.15s; }
      .tile:hover mat-card { background: #f5f5f5; }
      .tile-body { display: flex; align-items: center; gap: 1rem; }
      .tile-text h2 { margin: 0; font-size: 1.1rem; }
      .tile-text p { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.875rem; }
      mat-icon { font-size: 2rem; width: 2rem; height: 2rem; color: #1976d2; }
    `,
  ],
})
export class SettingsPage {
  private readonly auth = inject(Auth);

  protected readonly visibleTiles = computed<SettingsTile[]>(() => {
    const isAdmin = this.auth.user()?.role === 'Admin';
    return TILES.filter((t) => !t.adminOnly || isAdmin);
  });
}
