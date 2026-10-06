/**
 * One id per page load; identifies this window as the origin of its own writes.
 * Deliberately not in sessionStorage: Chrome copies that into a duplicated tab
 * (and window.open / ctrl-click windows), and two windows sharing an id would
 * each drop the other's realtime changes as their own echoes.
 */
const id = crypto.randomUUID();

export function clientId(): string {
  return id;
}
