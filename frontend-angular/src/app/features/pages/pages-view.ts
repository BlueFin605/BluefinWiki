import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'wiki-pages-view',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div style="display:flex; height:100vh;">
      <aside style="width:320px; border-right:1px solid #ccc; padding:1rem;">
        <strong>Pages (tree placeholder)</strong>
      </aside>
      <main style="flex:1; overflow:auto;">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class PagesView {}
