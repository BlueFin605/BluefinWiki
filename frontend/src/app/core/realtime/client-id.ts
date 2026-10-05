const KEY = 'wikiClientId';
let memoryId: string | undefined;

/** One id per browser tab; identifies this tab as the origin of its own writes. */
export function clientId(): string {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memoryId ??= crypto.randomUUID());
  }
}
