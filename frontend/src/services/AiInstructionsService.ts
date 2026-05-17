/**
 * AiInstructionsService — reads and manages "AI Instructions" pages.
 *
 * Convention: a single root page exists at the wiki root with title
 * ROOT_TITLE. Its direct children are individual AI instructions. The root
 * page is lazy-created the first time someone creates an instruction.
 */

import { apiClient } from '../config/api';
import type { PageContent, PageSummary } from '../types/page';

export const AI_INSTRUCTIONS_ROOT_TITLE = 'AI Instructions';

const NEW_INSTRUCTION_TEMPLATE = `Describe the task the AI should perform when this instruction is active.

For example:
- What kind of output you want
- Tone, structure, or formatting rules
- Steps to follow when the user asks for this task
`;

export interface AiInstructionSummary {
  guid: string;
  title: string;
}

export interface AiInstructionContent extends AiInstructionSummary {
  content: string;
}

let cachedRootGuid: string | null = null;

async function findRootGuid(): Promise<string | null> {
  if (cachedRootGuid) return cachedRootGuid;
  const response = await apiClient.get('/pages/root/children');
  const children: PageSummary[] = response.data.children || [];
  const match = children.find((p) => p.title === AI_INSTRUCTIONS_ROOT_TITLE);
  cachedRootGuid = match?.guid ?? null;
  return cachedRootGuid;
}

async function ensureRootGuid(): Promise<string> {
  const existing = await findRootGuid();
  if (existing) return existing;
  const response = await apiClient.post('/pages', {
    title: AI_INSTRUCTIONS_ROOT_TITLE,
    parentGuid: null,
    content: 'Reusable instructions for the AI assistant. Each child page is a single instruction the user can attach to a chat.',
  });
  const created = response.data as PageContent;
  cachedRootGuid = created.guid;
  return created.guid;
}

export async function listInstructions(): Promise<AiInstructionSummary[]> {
  const rootGuid = await findRootGuid();
  if (!rootGuid) return [];
  const response = await apiClient.get(`/pages/${rootGuid}/children`);
  const children: PageSummary[] = response.data.children || [];
  return children.map((c) => ({ guid: c.guid, title: c.title }));
}

export async function getInstructionContent(guid: string): Promise<AiInstructionContent> {
  const response = await apiClient.get<PageContent>(`/pages/${guid}`);
  return {
    guid: response.data.guid,
    title: response.data.title,
    content: response.data.content,
  };
}

export async function createInstruction(title: string): Promise<string> {
  const rootGuid = await ensureRootGuid();
  const response = await apiClient.post('/pages', {
    title,
    parentGuid: rootGuid,
    content: NEW_INSTRUCTION_TEMPLATE,
  });
  const created = response.data as PageContent;
  return created.guid;
}
