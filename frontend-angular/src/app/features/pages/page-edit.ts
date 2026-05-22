import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'wiki-page-edit',
  standalone: true,
  template: `<div style="padding:2rem;">Edit placeholder</div>`,
})
export class PageEdit {
  protected route = inject(ActivatedRoute);
}
