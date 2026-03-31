import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { PageSummary } from '../types/index.js';

interface SitemapNode extends PageSummary {
  children?: SitemapNode[];
}

/**
 * Lambda: pages-sitemap
 * GET /api/sitemap
 *
 * Returns all pages as a hierarchical JSON tree for the sitemap view.
 * Draft pages are excluded unless owned by the requesting user.
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserContext(event);
    const storagePlugin = getStoragePlugin();
    const tree = await storagePlugin.buildPageTree() as SitemapNode[];

    // Filter drafts not owned by the requesting user
    const filterDrafts = (pages: SitemapNode[]): SitemapNode[] => {
      return pages
        .filter(page => page.status !== 'draft' || page.modifiedBy === user.userId)
        .map(page => ({
          ...page,
          children: page.children ? filterDrafts(page.children) : [],
        }));
    };

    const filtered = filterDrafts(tree);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: filtered }),
    };
  } catch (err: unknown) {
    console.error('Error building sitemap:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to build sitemap' }),
    };
  }
});
