import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { Pages } from '../pages/pages';
import { PageTypes, SKIP_PAGE_TYPE_FETCH } from '../page-types/page-types';
import { PagePropertiesPanel, type PageTypeChange } from './page-properties-panel';
import { CustomPropertiesEditor } from './custom-properties-editor';
import { LinkedPagesPanel } from '../pages/linked-pages-panel';
import { AttachmentUploader } from '../attachments/attachment-uploader';
import { AttachmentManager } from '../attachments/attachment-manager';
import type { PageMetadata } from '../pages/drafts';
import type { PageProperty } from '../pages/page.types';

@Component({
  selector: 'wiki-inspector-panel',
  standalone: true,
  imports: [
    MatTabsModule,
    MatBadgeModule,
    PagePropertiesPanel,
    CustomPropertiesEditor,
    LinkedPagesPanel,
    AttachmentUploader,
    AttachmentManager,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Tab bodies use `*matTabContent` + `preserveContent` (lazy-once), NOT a
  // destroying `@if` on `selectedTab()` (Phase 4 review I8). The `@if` tore
  // down + rebuilt `PagePropertiesPanel` / `CustomPropertiesEditor` on every
  // Properties<->Attachments toggle, and each rebuild re-constructed its own
  // `rxResource` (page-types, page-tags, per-property tag vocabularies) — 5+
  // GETs per tab bounce, nothing shared. `matTabContent` defers construction
  // until a tab is first viewed; `preserveContent` then keeps it in the DOM
  // instead of detaching it on every switch-away, so a tab bounce refetches
  // nothing. (The eager mobile instantiation is handled one level up:
  // `pages-view` gates `<wiki-inspector-panel>` on `inspectorOpened()`.)
  template: `
    <mat-tab-group
      preserveContent
      [selectedIndex]="selectedTab()"
      (selectedIndexChange)="selectedTab.set($event)"
    >
      <mat-tab label="Properties">
        <ng-template matTabContent>
          <wiki-page-properties-panel
            [metadata]="metadata()"
            (metadataChange)="metadataChange.emit($event)"
            (titleH1Sync)="titleH1Sync.emit($event)"
            (pageTypeChange)="pageTypeChange.emit($event)"
          />
          <wiki-custom-properties-editor
            [pageType]="currentPageType()"
            [properties]="metadata().properties ?? {}"
            (propertiesChange)="onPropertiesChange($event)"
          />
        </ng-template>
      </mat-tab>

      <mat-tab label="Attachments">
        <ng-template matTabContent>
          <wiki-attachment-uploader
            [pageGuid]="pageGuid()"
            (uploaded)="insertMarkdown.emit($event.markdown)"
          />
          <wiki-attachment-manager
            [pageGuid]="pageGuid()"
            [pageAuthorId]="pageAuthorId()"
            [canInsert]="canInsert()"
            (insertMarkdown)="insertMarkdown.emit($event)"
          />
        </ng-template>
      </mat-tab>

      <mat-tab>
        <ng-template mat-tab-label>
          <span
            [matBadge]="backlinkCount()"
            [matBadgeHidden]="backlinkCount() === 0"
            [attr.aria-label]="
              backlinkCount() > 0
                ? 'Linked, ' + backlinkCount() + ' backlinks'
                : null
            "
            matBadgeOverlap="false"
            matBadgeSize="small"
          >Linked</span>
        </ng-template>
        <ng-template matTabContent>
          <wiki-linked-pages-panel [pageGuid]="pageGuid()" />
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `],
})
export class InspectorPanel {
  private readonly pages = inject(Pages);
  private readonly pageTypes = inject(PageTypes);

  readonly pageGuid = input.required<string>();
  readonly metadata = input.required<PageMetadata>();
  readonly pageAuthorId = input<string | null>(null);
  /** Whether attachments can be inserted into a live editor (edit mode only). */
  readonly canInsert = input<boolean>(true);

  readonly metadataChange = output<PageMetadata>();
  /**
   * Markdown to drop in at the editor cursor. Carries both the attachment
   * manager's Insert action (step 4.8) and, on the uploader's `uploaded` event,
   * the ready-to-insert markdown of a freshly uploaded attachment (step 4.9) —
   * one route to `page-detail`'s shared `insertMarkdownAtCursor`.
   */
  readonly insertMarkdown = output<string>();
  /**
   * Forwarded from {@link PagePropertiesPanel.titleH1Sync}: the host rewrites a
   * leading `# H1` line in the editor buffer when the user edits the Title.
   */
  readonly titleH1Sync = output<string>();
  /**
   * Forwarded from {@link PagePropertiesPanel.pageTypeChange}: the host persists
   * the new page type + its merged property set immediately (step 4.4).
   */
  readonly pageTypeChange = output<PageTypeChange>();

  protected readonly selectedTab = signal(0);

  private readonly pageTypeSignal = computed(() =>
    this.metadata().pageType ?? SKIP_PAGE_TYPE_FETCH,
  );

  private readonly pageTypeResource = this.pageTypes.pageTypeResource(this.pageTypeSignal);
  protected readonly currentPageType = computed(() =>
    this.pageTypeResource.status() === 'resolved'
      ? this.pageTypeResource.value() ?? null
      : null,
  );

  // Backlinks resource just to drive the badge count; the panel re-creates
  // its own resource internally, but the count is needed here for the tab
  // label. Pulled out as a computed.
  private readonly guidSignal = computed(() => this.pageGuid());
  private readonly backlinksResource = this.pages.backlinksResource(this.guidSignal);
  protected readonly backlinkCount = computed(() => {
    if (this.backlinksResource.status() !== 'resolved') return 0;
    return this.backlinksResource.value()?.count ?? 0;
  });

  protected onPropertiesChange(properties: Record<string, PageProperty>): void {
    const next: PageMetadata = { ...this.metadata(), properties };
    this.metadataChange.emit(next);
  }
}
