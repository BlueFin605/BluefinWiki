import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'wiki-forbidden',
  imports: [RouterLink, MatButtonModule],
  template: `
    <main style="padding:2rem; text-align:center;">
      <h1>403</h1>
      <p>You don't have permission to view this page.</p>
      <a routerLink="/pages" mat-stroked-button>Go to Pages</a>
    </main>
  `,
})
export class ForbiddenComponent {}
