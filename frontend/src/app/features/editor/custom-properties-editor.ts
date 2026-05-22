import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { PageProperty, PageTypeDefinition, PageTypeProperty } from '../pages/page.types';

@Component({
  selector: 'wiki-custom-properties-editor',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      @for (prop of pageType().properties; track prop.name) {
        <mat-form-field appearance="fill" class="full">
          <mat-label>{{ prop.name }}</mat-label>
          @if (prop.type === 'string') {
            <input
              matInput
              type="text"
              [disabled]="!editable()"
              [value]="stringValue(prop)"
              (input)="onStringChange(prop, $event)"
            />
          } @else if (prop.type === 'number') {
            <input
              matInput
              type="number"
              [disabled]="!editable()"
              [value]="numberValue(prop)"
              (input)="onNumberChange(prop, $event)"
            />
          } @else if (prop.type === 'date') {
            <input
              matInput
              type="date"
              [disabled]="!editable()"
              [value]="stringValue(prop)"
              (input)="onStringChange(prop, $event)"
            />
          } @else if (prop.type === 'tags') {
            <input
              matInput
              type="text"
              [disabled]="!editable()"
              placeholder="comma-separated"
              [value]="tagsValue(prop)"
              (input)="onTagsChange(prop, $event)"
            />
          }
        </mat-form-field>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .panel { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
    .full { width: 100%; }
  `],
})
export class CustomPropertiesEditor {
  readonly pageType = input.required<PageTypeDefinition>();
  readonly properties = input<Record<string, PageProperty>>({});
  readonly editable = input<boolean>(true);
  readonly propertiesChange = output<Record<string, PageProperty>>();

  protected stringValue(prop: PageTypeProperty): string {
    const v = this.properties()[prop.name]?.value ?? prop.defaultValue ?? '';
    return typeof v === 'string' ? v : '';
  }

  protected numberValue(prop: PageTypeProperty): number | string {
    const v = this.properties()[prop.name]?.value ?? prop.defaultValue ?? '';
    return typeof v === 'number' ? v : '';
  }

  protected tagsValue(prop: PageTypeProperty): string {
    const v = this.properties()[prop.name]?.value ?? prop.defaultValue ?? [];
    return Array.isArray(v) ? v.join(', ') : '';
  }

  protected onStringChange(prop: PageTypeProperty, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.emitChange(prop, { type: prop.type, value: target.value });
  }

  protected onNumberChange(prop: PageTypeProperty, event: Event): void {
    const target = event.target as HTMLInputElement;
    const num = target.value === '' ? '' : Number(target.value);
    this.emitChange(prop, { type: prop.type, value: num === '' ? '' : num });
  }

  protected onTagsChange(prop: PageTypeProperty, event: Event): void {
    const target = event.target as HTMLInputElement;
    const tags = target.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.emitChange(prop, { type: prop.type, value: tags });
  }

  private emitChange(prop: PageTypeProperty, value: PageProperty): void {
    const next: Record<string, PageProperty> = { ...this.properties(), [prop.name]: value };
    this.propertiesChange.emit(next);
  }
}
