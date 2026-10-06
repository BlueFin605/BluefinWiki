/** Initiative key prefix, e.g. BGT. */
export const KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
/** A ticket key as typed by a user, e.g. BGT-12 (any case). */
export const TICKET_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
export const isTicketKey = (s: string): boolean => TICKET_KEY_PATTERN.test(s.trim());
