import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotFound } from '../not-found/not-found';
import { TicketKeys } from './ticket-keys';

/**
 * `/t/:key` — resolves a ticket key (BGT-12) and replaces the URL with the
 * page's `/pages/:guid`. Unknown keys render the not-found page in place.
 */
@Component({
  selector: 'wiki-ticket-key-redirect',
  imports: [NotFound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (notFound()) {
    <wiki-not-found />
  } @else {
    <p class="resolving" role="status">Opening {{ key }}…</p>
  }`,
  styles: [`.resolving { padding: 2rem; text-align: center; color: #6b7280; }`],
})
export class TicketKeyRedirect {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ticketKeys = inject(TicketKeys);
  // app.config does not use withComponentInputBinding; read the param from the snapshot.
  protected readonly key = this.route.snapshot.paramMap.get('key') ?? '';
  protected readonly notFound = signal(false);

  constructor() {
    void this.resolve();
  }

  private async resolve(): Promise<void> {
    try {
      const r = await this.ticketKeys.resolve(this.key);
      if (!r) {
        this.notFound.set(true);
        return;
      }
      await this.router.navigate(['/pages', r.guid], { replaceUrl: true });
    } catch {
      this.notFound.set(true);
    }
  }
}
