import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'wiki-not-found',
  imports: [RouterLink, MatButtonModule],
  template: `
    <main style="padding:2rem; text-align:center;">
      <h1>404</h1>
      <p>Page not found.</p>
      <a routerLink="/" mat-stroked-button>Go home</a>
    </main>
  `,
})
export class NotFound {}
