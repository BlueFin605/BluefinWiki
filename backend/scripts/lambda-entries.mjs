// Lambda entry points, as paths under dist/ without extension. UnifiedStack.cs uses
// Handler = "<entry>.handler"; src/router/__tests__/cdk-parity.test.ts keeps the two in step.
export const LAMBDA_ENTRIES = [
  'router/lambda',
  'auth/auth-pre-signup',
  'auth/auth-post-confirmation',
  'auth/auth-pre-token-generation',
  'auth/auth-custom-message',
  'realtime/ws-connect',
  'realtime/ws-disconnect',
  'realtime/ws-default',
  'search/vector-index-builder',
  'mcp/mcp-handler',
  'proxy/fetch-url',
  'ticket-keys/ticket-keys-backfill-handler',
  'pages/board-order-backfill-handler',
  'storage/rebuild-page-index',
];
