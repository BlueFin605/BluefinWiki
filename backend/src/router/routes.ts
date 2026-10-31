import type { LambdaHandler, RouteDef } from './types.js';

/** Narrow a handler module's `handler` export to the router's handler type. */
const h = (mod: Promise<{ handler: unknown }>): Promise<LambdaHandler> => mod.then((m) => m.handler as LambdaHandler);

/**
 * Every REST API route. infrastructure/.../UnifiedStack.cs decides which routes exist and
 * which keep their own Lambda; __tests__/cdk-parity.test.ts fails if the two disagree.
 * Each import() is a literal so esbuild splits it into a chunk loaded on first use.
 */
export const ROUTES: readonly RouteDef[] = [
  // Pages
  { method: 'POST', pattern: '/pages', deployment: 'router', load: () => h(import('../pages/pages-create.js')) },
  { method: 'GET', pattern: '/pages/children', deployment: 'router', load: () => h(import('../pages/pages-list-children.js')) },
  { method: 'GET', pattern: '/pages/search', deployment: 'router', load: () => h(import('../pages/pages-search.js')) },
  { method: 'PUT', pattern: '/pages/reorder', deployment: 'router', load: () => h(import('../pages/pages-reorder.js')) },
  { method: 'POST', pattern: '/pages/links/resolve', deployment: 'router', load: () => h(import('../pages/links-resolve.js')) },
  { method: 'GET', pattern: '/pages/{guid}', deployment: 'router', load: () => h(import('../pages/pages-get.js')) },
  { method: 'PUT', pattern: '/pages/{guid}', deployment: 'router', load: () => h(import('../pages/pages-update.js')) },
  { method: 'DELETE', pattern: '/pages/{guid}', deployment: 'router', load: () => h(import('../pages/pages-delete.js')) },
  { method: 'GET', pattern: '/pages/{guid}/children', deployment: 'router', load: () => h(import('../pages/pages-list-children.js')) },
  { method: 'PUT', pattern: '/pages/{guid}/move', deployment: 'router', load: () => h(import('../pages/pages-move.js')) },
  { method: 'GET', pattern: '/pages/{guid}/ancestors', deployment: 'router', load: () => h(import('../pages/pages-ancestors.js')) },
  { method: 'GET', pattern: '/pages/{guid}/backlinks', deployment: 'router', load: () => h(import('../pages/pages-backlinks.js')) },
  // 5-minute jobs: own Lambdas (beyond API Gateway's 29 s integration timeout)
  { method: 'POST', pattern: '/pages/{guid}/ticket-keys/backfill', deployment: 'own-function', load: () => h(import('../ticket-keys/ticket-keys-backfill-handler.js')) },
  { method: 'POST', pattern: '/pages/{guid}/board-order/backfill', deployment: 'own-function', load: () => h(import('../pages/board-order-backfill-handler.js')) },

  // Attachments
  { method: 'POST', pattern: '/pages/{guid}/attachments', deployment: 'router', load: () => h(import('../pages/pages-attachments-upload.js')) },
  { method: 'GET', pattern: '/pages/{guid}/attachments', deployment: 'router', load: () => h(import('../pages/pages-attachments-list.js')) },
  { method: 'POST', pattern: '/pages/{guid}/attachments/presign', deployment: 'router', load: () => h(import('../pages/pages-attachments-presign.js')) },
  { method: 'POST', pattern: '/pages/{guid}/attachments/confirm', deployment: 'router', load: () => h(import('../pages/pages-attachments-confirm.js')) },
  { method: 'GET', pattern: '/pages/{guid}/attachments/{attachmentGuid}', deployment: 'router', load: () => h(import('../pages/pages-attachments-download.js')) },
  { method: 'DELETE', pattern: '/pages/{guid}/attachments/{attachmentGuid}', deployment: 'router', load: () => h(import('../pages/pages-attachments-delete.js')) },

  // Comments
  { method: 'GET', pattern: '/pages/{guid}/comments', deployment: 'router', load: () => h(import('../pages/pages-comments-list.js')) },
  { method: 'POST', pattern: '/pages/{guid}/comments', deployment: 'router', load: () => h(import('../pages/pages-comments-create.js')) },
  { method: 'PUT', pattern: '/pages/{guid}/comments/{commentId}', deployment: 'router', load: () => h(import('../pages/pages-comments-update.js')) },
  { method: 'DELETE', pattern: '/pages/{guid}/comments/{commentId}', deployment: 'router', load: () => h(import('../pages/pages-comments-delete.js')) },

  // Ticket keys, search, utilities
  { method: 'GET', pattern: '/ticket-keys/{key}', deployment: 'router', load: () => h(import('../ticket-keys/ticket-keys-resolve.js')) },
  { method: 'GET', pattern: '/search', deployment: 'router', load: () => h(import('../search/search-query.js')) },
  // Own no-data-access role: SSRF defence in depth
  { method: 'POST', pattern: '/fetch-url', deployment: 'own-function', load: () => h(import('../proxy/fetch-url.js')) },
  { method: 'GET', pattern: '/imdb/show-details', deployment: 'router', load: () => h(import('../proxy/imdb-show-details.js')) },

  // Tags
  { method: 'GET', pattern: '/tags', deployment: 'router', load: () => h(import('../tags/tags-list.js')) },
  { method: 'POST', pattern: '/tags', deployment: 'router', load: () => h(import('../tags/tags-create.js')) },

  // Page types
  { method: 'GET', pattern: '/page-types', deployment: 'router', load: () => h(import('../page-types/page-types-list.js')) },
  { method: 'POST', pattern: '/page-types', deployment: 'router', load: () => h(import('../page-types/page-types-create.js')) },
  { method: 'GET', pattern: '/page-types/{guid}', deployment: 'router', load: () => h(import('../page-types/page-types-get.js')) },
  { method: 'PUT', pattern: '/page-types/{guid}', deployment: 'router', load: () => h(import('../page-types/page-types-update.js')) },
  { method: 'DELETE', pattern: '/page-types/{guid}', deployment: 'router', load: () => h(import('../page-types/page-types-delete.js')) },
  { method: 'GET', pattern: '/page-types/{guid}/allowed-children', deployment: 'router', load: () => h(import('../page-types/page-types-allowed-children.js')) },

  // Auth (POST /auth/register has no authorizer in API Gateway)
  { method: 'POST', pattern: '/auth/register', deployment: 'router', load: () => h(import('../auth/auth-register.js')) },
  { method: 'GET', pattern: '/auth/me', deployment: 'router', load: () => h(import('../auth/auth-me.js')) },
  { method: 'PUT', pattern: '/auth/profile', deployment: 'router', load: () => h(import('../auth/auth-profile-update.js')) },

  // Admin
  { method: 'GET', pattern: '/admin/users', deployment: 'router', load: () => h(import('../auth/admin-users-list.js')) },
  { method: 'GET', pattern: '/admin/users/{userId}', deployment: 'router', load: () => h(import('../auth/admin-users-get.js')) },
  { method: 'PUT', pattern: '/admin/users/{userId}', deployment: 'router', load: () => h(import('../auth/admin-users-update.js')) },
  { method: 'DELETE', pattern: '/admin/users/{userId}', deployment: 'router', load: () => h(import('../auth/admin-users-delete.js')) },
  { method: 'POST', pattern: '/admin/users/{userId}/suspend', deployment: 'router', load: () => h(import('../auth/admin-users-suspend.js')) },
  { method: 'POST', pattern: '/admin/users/{userId}/activate', deployment: 'router', load: () => h(import('../auth/admin-users-activate.js')) },
  { method: 'GET', pattern: '/admin/invitations', deployment: 'router', load: () => h(import('../auth/admin-list-invitations.js')) },
  { method: 'POST', pattern: '/admin/invitations', deployment: 'router', load: () => h(import('../auth/admin-create-invitation.js')) },
  // The handler reads pathParameters.code; set both names.
  { method: 'DELETE', pattern: '/admin/invitations/{invitationCode}', deployment: 'router', paramAliases: { invitationCode: 'code' }, load: () => h(import('../auth/admin-revoke-invitation.js')) },
  { method: 'POST', pattern: '/admin/rebuild-page-index', deployment: 'own-function', load: () => h(import('../storage/rebuild-page-index.js')) },

  // MCP server: own Lambda, reduced IAM role, API-key route in production
  { method: 'POST', pattern: '/mcp', deployment: 'own-function', load: () => h(import('../mcp/mcp-handler.js')) },
  { method: 'GET', pattern: '/mcp', deployment: 'own-function', load: () => h(import('../mcp/mcp-handler.js')) },
];
