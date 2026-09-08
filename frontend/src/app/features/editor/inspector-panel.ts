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
import { PagePropertiesPanel } from './page-properties-panel';
import { CustomPropertiesEditor } from './custom-properties-editor';
import { LinkedPagesPanel } from '../pages/linked-pages-panel';
import { AttachmentUploader } from '../attachments/attachment-uploader';
import { AttachmentManager } from '../attachments/attachment-manager';
import type { PageMetadata } from '../pages/drafts';
import type { PageProperty } from '../pages/page.types';

@Component({
  selector: 'wiki-inspector-panel',
  standalone: true,
  host: { '[attr.data-presentation]': 'presentation()' },
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
  template: `
    <mat-tab-group [selectedIndex]="selectedTab()" (selectedIndexChange)="selectedTab.set($event)">
      <mat-tab label="Properties">
        @if (selectedTab() === 0) {
          <wiki-page-properties-panel
            [metadata]="metadata()"
            (metadataChange)="metadataChange.emit($event)"
          />
          @if (currentPageType(); as pt) {
            <wiki-custom-properties-editor
              [pageType]="pt"
              [properties]="metadata().properties ?? {}"
              (propertiesChange)="onPropertiesChange($event)"
            />
          }
        }
      </mat-tab>

      <mat-tab label="Attachments">
        @if (selectedTab() === 1) {
          <wiki-attachment-uploader
            [pageGuid]="pageGuid()"
            (uploaded)="attachmentUploaded.set($event.filename)"
          />
          <wiki-attachment-manager
            [pageGuid]="pageGuid()"
            [pageAuthorId]="pageAuthorId()"
            [canInsert]="canInsert()"
            (insertMarkdown)="insertMarkdown.emit($event)"
          />
        }
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
        @if (selectedTab() === 2) {
          <wiki-linked-pages-panel [pageGuid]="pageGuid()" />
        }
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
  /**
   * How the panel is presented. `'side'` (default) is the desktop right-hand
   * resizable panel; `'sheet'` is the mobile bottom-sheet / full-screen
   * overlay. Step 4.1 only exposes this seam and reflects it on the host as
   * `data-presentation` — the responsive breakpoint that flips it and the
   * sheet's drag / dismiss behaviour are owned by Phase 1b step 1b.5.
   */
  readonly presentation = input<'side' | 'sheet'>('side');

  readonly metadataChange = output<PageMetadata>();
  readonly insertMarkdown = output<string>();

  protected readonly selectedTab = signal(0);

  // Track the most recent successful upload for downstream consumers.
  protected readonly attachmentUploaded = signal<string | null>(null);

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
