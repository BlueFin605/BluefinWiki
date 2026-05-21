import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import type { EmbeddedViewRef } from '@angular/core';
import { Auth } from '../../core/auth/auth';
import type { Role } from '../../core/auth/auth.types';

@Directive({
  selector: '[appPermission]',
  standalone: true,
})
export class Permission {
  private template = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  private auth = inject(Auth);

  readonly appPermission = input.required<Role>();

  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const required = this.appPermission();
      const userRole = this.auth.user()?.role;
      const allowed = userRole === 'Admin' || userRole === required;
      if (allowed && !this.view) {
        this.view = this.vcr.createEmbeddedView(this.template);
      } else if (!allowed && this.view) {
        this.vcr.clear();
        this.view = null;
      }
    });
  }
}
