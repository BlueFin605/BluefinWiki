/**
 * Pages Lambda Functions
 * 
 * This module exports all Lambda handlers for page CRUD operations.
 * These handlers implement the /pages API endpoints.
 */

export { handler as pagesCreate } from './pages-create.js';
export { handler as pagesGet } from './pages-get.js';
export { handler as pagesUpdate } from './pages-update.js';
export { handler as pagesDelete } from './pages-delete.js';
export { handler as pagesListChildren } from './pages-list-children.js';
export { handler as pagesMove } from './pages-move.js';
