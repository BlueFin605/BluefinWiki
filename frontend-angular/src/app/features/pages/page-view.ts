import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'wiki-page-view',
  standalone: true,
  template: `<div style="padding:2rem;">View placeholder</div>`,
})
export class PageView {
  protected route = inject(ActivatedRoute);
}
