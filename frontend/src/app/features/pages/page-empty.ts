import { Component } from '@angular/core';

@Component({
  selector: 'wiki-page-empty',
  standalone: true,
  template: `<div style="padding:2rem; color:#666;">Select a page to begin.</div>`,
})
export class PageEmpty {}
