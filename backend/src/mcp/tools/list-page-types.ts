/**
 * MCP Tool: list_page_types
 *
 * List all page type definitions with their property schemas.
 * Page types define what properties a page should have (e.g., a "TV Show" type has rating, genre, status).
 */

import { listPageTypes as listPageTypeDefinitions } from '../../page-types/page-types-service.js';
import type { PageTypeProperty } from '../../types/index.js';

interface PageType {
  guid: string;
  name: string;
  icon: string;
  properties: PageTypeProperty[];
  allowedChildTypes: string[];
}

/**
 * List all page type definitions. Reads the table on every call (one Scan of
 * a tiny table) so a warm Lambda never serves types from its cold start.
 */
export async function listPageTypes(): Promise<PageType[]> {
  const types = await listPageTypeDefinitions();
  return types.map(({ guid, name, icon, properties, allowedChildTypes }) => ({
    guid,
    name,
    icon,
    properties,
    allowedChildTypes,
  }));
}
