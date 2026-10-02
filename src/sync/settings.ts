// Where this device syncs to. Kept per browser or desktop install in localStorage, like any login token a web
// page keeps; it never goes into a board or a file.
const KEY = "scratchii.sync";

export interface SyncSettings {
  readonly url: string;
  readonly token: string;
}

export function readSyncSettings(): SyncSettings | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<SyncSettings> | null;
    return typeof parsed?.url === "string" && typeof parsed.token === "string" && parsed.url !== ""
      ? { url: parsed.url, token: parsed.token }
      : null;
  } catch {
    // Storage blocked or a hand-edited value: the device simply does not sync.
    return null;
  }
}

export function writeSyncSettings(settings: SyncSettings | null): boolean {
  try {
    if (settings === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
