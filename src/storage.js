/**
 * Best-effort persistence. Sandboxed frames and private windows can throw on
 * access rather than merely returning null, and nothing here is worth losing
 * a game in progress over.
 */

export function readText(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readNumber(key) {
  const value = Number(readText(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* not persisted; play continues */
  }
}
