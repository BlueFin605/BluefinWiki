import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface RebuildResult {
  totalPages: number;
  indexed: number;
  failed: number;
  errors: string[];
  durationMs: number;
  deletedOrphans: number;
  orphanGuids: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminTasks {
  private readonly http = inject(HttpClient);

  async rebuildPageIndex(): Promise<RebuildResult> {
    return firstValueFrom(
      this.http.post<RebuildResult>('/api/admin/rebuild-page-index', {}),
    );
  }
}
