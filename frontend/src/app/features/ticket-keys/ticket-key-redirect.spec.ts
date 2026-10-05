import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TicketKeyRedirect } from './ticket-key-redirect';
import { TicketKeys } from './ticket-keys';

async function settle(fixture: { detectChanges(): void }): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  fixture.detectChanges();
}

function setup(resolve: jest.Mock) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TicketKeys, useValue: { resolve } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['key', 'BGT-12']]) } } },
    ],
  });
  const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(TicketKeyRedirect);
  return { fixture, navigate };
}

describe('TicketKeyRedirect', () => {
  it('replaces the URL with /pages/:key when the key resolves', async () => {
    const resolve = jest.fn().mockResolvedValue({ key: 'BGT-12', guid: 'g1', title: 'T' });
    const { fixture, navigate } = setup(resolve);
    fixture.detectChanges();
    await settle(fixture);
    expect(resolve).toHaveBeenCalledWith('BGT-12');
    expect(navigate).toHaveBeenCalledWith(['/pages', 'BGT-12'], { replaceUrl: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-not-found')).toBeNull();
  });

  it('renders not-found when the key is unknown', async () => {
    const { fixture, navigate } = setup(jest.fn().mockResolvedValue(null));
    fixture.detectChanges();
    await settle(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-not-found')).not.toBeNull();
  });

  it('renders not-found when resolving fails', async () => {
    const { fixture } = setup(jest.fn().mockRejectedValue(new Error('boom')));
    fixture.detectChanges();
    await settle(fixture);
    expect((fixture.nativeElement as HTMLElement).querySelector('wiki-not-found')).not.toBeNull();
  });
});
