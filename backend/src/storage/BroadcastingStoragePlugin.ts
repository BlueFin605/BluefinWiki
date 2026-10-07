/**
 * Storage decorator that publishes real-time updates after writes.
 *
 * Every StoragePlugin method delegates to the wrapped plugin. Write methods
 * additionally publish (`publishUpsert` for page saves, `publishChange`
 * otherwise) once the inner call has resolved — never when it rejects (the
 * error propagates untouched). Publishing never throws and waits at most 1 s,
 * so it can't fail or stall a write.
 */

import { StoragePlugin } from './StoragePlugin.js';
import {
  PageContent,
  Version,
  PageSummary,
  AttachmentUploadInput,
  AttachmentUploadResult,
  AttachmentMetadata,
  Comment,
} from '../types/index.js';
import { publishChange, publishUpsert } from '../realtime/broadcaster.js';
import { toPageSummary } from '../realtime/page-summary.js';
import {
  tagsForSavePage,
  tagsForDeletePage,
  tagsForMovePage,
  tagsForComments,
  tagsForAttachments,
} from '../realtime/change-tags.js';

/**
 * Attachment keys are `{...folders}/{pageGuid}/_attachments/{filename}` (see
 * S3StoragePlugin.buildAttachmentPath); the filename is sanitised so it holds
 * no `/`. Anything else yields null and nothing is published.
 */
const ATTACHMENT_KEY = /(?:^|\/)([^/]+)\/_attachments\/[^/]+$/;

export class BroadcastingStoragePlugin implements StoragePlugin {
  constructor(private readonly inner: StoragePlugin) {}

  // --- writes: delegate, then publish ---------------------------------------

  /**
   * A visible page is broadcast as its summary so clients patch it in place.
   * Drafts are per-user (see filterDrafts) so their data must not be
   * broadcast, and archived/deleted pages leave lists — both get coarse tags.
   */
  async savePage(guid: string, parentGuid: string | null, content: PageContent): Promise<void> {
    await this.inner.savePage(guid, parentGuid, content);
    if (content.status === 'draft' || content.status === 'archived' || content.status === 'deleted') {
      await publishChange(tagsForSavePage(guid, parentGuid));
    } else {
      await publishUpsert({ ...toPageSummary(content, parentGuid), guid });
    }
  }

  async deletePage(guid: string, recursive?: boolean): Promise<void> {
    await this.inner.deletePage(guid, recursive);
    await publishChange(tagsForDeletePage(guid));
  }

  async movePage(guid: string, newParentGuid: string | null): Promise<void> {
    await this.inner.movePage(guid, newParentGuid);
    await publishChange(tagsForMovePage(guid, newParentGuid));
  }

  async saveComments(pageGuid: string, comments: Comment[], expectedEtag: string | null): Promise<{ etag: string }> {
    const result = await this.inner.saveComments(pageGuid, comments, expectedEtag);
    await publishChange(tagsForComments(pageGuid));
    return result;
  }

  async uploadAttachment(pageGuid: string, file: AttachmentUploadInput): Promise<AttachmentUploadResult> {
    const result = await this.inner.uploadAttachment(pageGuid, file);
    await publishChange(tagsForAttachments(pageGuid));
    return result;
  }

  async deleteAttachment(pageGuid: string, filename: string): Promise<void> {
    await this.inner.deleteAttachment(pageGuid, filename);
    await publishChange(tagsForAttachments(pageGuid));
  }

  async saveAttachmentMetadata(pageGuid: string, filename: string, metadata: AttachmentMetadata): Promise<void> {
    await this.inner.saveAttachmentMetadata(pageGuid, filename, metadata);
    await publishChange(tagsForAttachments(pageGuid));
  }

  async deleteAttachmentByKey(attachmentKey: string): Promise<void> {
    await this.inner.deleteAttachmentByKey(attachmentKey);
    const pageGuid = ATTACHMENT_KEY.exec(attachmentKey)?.[1];
    if (pageGuid) await publishChange(tagsForAttachments(pageGuid));
  }

  // --- reads and everything else: plain delegation --------------------------

  loadPage(guid: string): Promise<PageContent> {
    return this.inner.loadPage(guid);
  }

  getPageFileKey(guid: string): Promise<string | null> {
    return this.inner.getPageFileKey(guid);
  }

  listVersions(guid: string): Promise<Version[]> {
    return this.inner.listVersions(guid);
  }

  listChildren(parentGuid: string | null): Promise<PageSummary[]> {
    return this.inner.listChildren(parentGuid);
  }

  getAttachmentMetadata(pageGuid: string, filename: string): Promise<AttachmentMetadata> {
    return this.inner.getAttachmentMetadata(pageGuid, filename);
  }

  listAttachments(pageGuid: string): Promise<AttachmentMetadata[]> {
    return this.inner.listAttachments(pageGuid);
  }

  getAttachmentUrl(pageGuid: string, filename: string): Promise<string> {
    return this.inner.getAttachmentUrl(pageGuid, filename);
  }

  getAttachmentUploadUrl(
    pageGuid: string,
    filename: string,
    contentType: string,
    maxContentLength: number
  ): Promise<{ uploadUrl: string; attachmentKey: string }> {
    return this.inner.getAttachmentUploadUrl(pageGuid, filename, contentType, maxContentLength);
  }

  headAttachment(
    pageGuid: string,
    attachmentKey: string
  ): Promise<{ contentLength: number; contentType: string | undefined } | null> {
    return this.inner.headAttachment(pageGuid, attachmentKey);
  }

  getComments(pageGuid: string): Promise<{ comments: Comment[]; etag: string | null }> {
    return this.inner.getComments(pageGuid);
  }

  getAncestors(guid: string): Promise<PageSummary[]> {
    return this.inner.getAncestors(guid);
  }

  isDescendantOf(pageGuid: string, ancestorGuid: string): Promise<boolean> {
    return this.inner.isDescendantOf(pageGuid, ancestorGuid);
  }

  buildPageTree(): Promise<PageSummary[]> {
    return this.inner.buildPageTree();
  }

  healthCheck(): Promise<boolean> {
    return this.inner.healthCheck();
  }

  getType(): string {
    return this.inner.getType();
  }
}
