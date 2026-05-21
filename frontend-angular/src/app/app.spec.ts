import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('renders the toolbar title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toolbar: HTMLElement = fixture.nativeElement.querySelector('mat-toolbar');
    expect(toolbar.textContent).toContain('BlueFinWiki');
  });
});
