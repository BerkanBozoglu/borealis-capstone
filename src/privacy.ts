// Privacy helpers shared by the build and the browser.
// GitHub usernames never reach the front end: the site ships a short key
// (hash of the lowercased login) so the inbox can still match issue assignees.
export function handleKey(login: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit
  for (const ch of login.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
