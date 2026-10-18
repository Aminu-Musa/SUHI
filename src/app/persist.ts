/* localStorage access that cannot take the app down (ruling 6).
 *
 * The original reads `localStorage.getItem('suhi.theme')` bare (prototype lines 546, 557) and
 * writes it bare (lines 1015, 1017). In a private window, with third-party/site data blocked,
 * or inside a sandboxed iframe, the ACCESSOR ITSELF throws a SecurityError - not the call, the
 * `localStorage` property lookup - so a bare read is enough to stop the module evaluating and
 * the dashboard never boots. Every read and write here is wrapped, and a failure degrades to
 * the default rather than to a blank page. */

/** Reads a persisted string, or `fallback` when storage is unavailable, empty, or throwing. */
export function readStored(key: string, fallback: string): string {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null || raw === '' ? fallback : raw;
  } catch {
    return fallback;
  }
}

/** Reads a persisted string and keeps it only if it is one of `allowed`. */
export function readStoredEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = readStored(key, fallback);
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** Persists a value. A throwing or full storage is swallowed: the session still works. */
export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* no-op: persistence is a convenience, never a precondition */
  }
}
