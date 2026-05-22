/**
 * AiInstructions — reads and manages "AI Instructions" pages.
 *
 * Ports `frontend/src/services/AiInstructionsService.ts`. Convention: a
 * single root page exists at the wiki root with title ROOT_TITLE; its direct
 * children are individual AI instructions. The root page is lazy-created the
 * first time someone creates an instruction.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  PageContent,
  PageSummary,
} from '../pages/page.types';

export const AI_INSTRUCTIONS_ROOT_TITLE = 'AI Instructions';

const NEW_INSTRUCTION_TEMPLATE = `Describe the task the AI should perform when this instruction is active.

For example:
- What kind of output you want
- Tone, structure, or formatting rules
- Steps to follow when the user asks for this task
`;

const ROOT_DESCRIPTION =
  'Reusable instructions for the AI assistant. Each child page is a single instruction the user can attach to a chat.';

export interface AiInstructionSummary {
  guid: string;
  title: string;
}

export interface AiInstructionContent extends AiInstructionSummary {
  content: string;
}

interface ChildrenResponse {
  children: PageSummary[];
}

@Injectable({ providedIn: 'root' })
export class AiInstructions {
  private readonly http = inject(HttpClient);
  private cachedRootGuid: string | null = null;

  async listInstructions(): Promise<AiInstructionSummary[]> {
    const rootGuid = await this.findRootGuid();
    if (!rootGuid) return [];
    const response = await firstValueFrom(
      this.http.get<ChildrenResponse>(`/api/pages/${rootGuid}/children`),
    );
    const children = response.children ?? [];
    return children.map((c) => ({ guid: c.guid, title: c.title }));
  }

  async getInstructionContent(guid: string): Promise<AiInstructionContent> {
    const response = await firstValueFrom(
      this.http.get<PageContent>(`/api/pages/${guid}`),
    );
    return {
      guid: response.guid,
      title: response.title,
      content: response.content,
    };
  }

  async createInstruction(title: string): Promise<string> {
    const rootGuid = await this.ensureRootGuid();
    const created = await firstValueFrom(
      this.http.post<PageContent>('/api/pages', {
        title,
        parentGuid: rootGuid,
        content: NEW_INSTRUCTION_TEMPLATE,
      }),
    );
    return created.guid;
  }

  /** Test-only: discard cached root guid so a fresh lookup happens. */
  __clearCacheForTests(): void {
    this.cachedRootGuid = null;
  }

  private async findRootGuid(): Promise<string | null> {
    if (this.cachedRootGuid) return this.cachedRootGuid;
    const response = await firstValueFrom(
      this.http.get<ChildrenResponse>('/api/pages/root/children'),
    );
    const children = response.children ?? [];
    const match = children.find((p) => p.title === AI_INSTRUCTIONS_ROOT_TITLE);
    this.cachedRootGuid = match?.guid ?? null;
    return this.cachedRootGuid;
  }

  private async ensureRootGuid(): Promise<string> {
    const existing = await this.findRootGuid();
    if (existing) return existing;
    const created = await firstValueFrom(
      this.http.post<PageContent>('/api/pages', {
        title: AI_INSTRUCTIONS_ROOT_TITLE,
        parentGuid: null,
        content: ROOT_DESCRIPTION,
      }),
    );
    this.cachedRootGuid = created.guid;
    return created.guid;
  }
}
